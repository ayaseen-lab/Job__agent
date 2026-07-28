import { chromium } from 'playwright';
import {
  isJobApplied,
  markJobApplied,
  incrementJobsApplied,
  updateTodayStats,
  logActivity,
  getTodayStats,
  setConnectsExhaustedAt,
} from './db.js';
import { generateTailoredMessage } from './messageGenerator.js';
import { pause, fastFill, fastClick } from './humanDelay.js';

const V2_LOGIN_URL = 'https://v2.onlinejobs.ph/login';
const WWW_LOGIN_URL = 'https://www.onlinejobs.ph/login';
const BASE_SEARCH = 'https://www.onlinejobs.ph/jobseekers/jobsearch?jobkeyword=';
const DEFAULT_KEYWORDS = ['React', 'Software Engineer', 'AI Engineer', 'Backend Developer'];
const MAX_PAGES = Number(process.env.MAX_SEARCH_PAGES) || 3;
const MIN_CONNECTS_RESERVE = Number(process.env.MIN_CONNECTS_RESERVE) || 0;

function getSearchKeywords() {
  const raw = process.env.JOB_KEYWORDS;
  if (raw) return raw.split(',').map((k) => k.trim()).filter(Boolean);
  return DEFAULT_KEYWORDS;
}

function buildSearchUrl(keyword, page = 1) {
  const base = `${BASE_SEARCH}${encodeURIComponent(keyword)}`;
  return page === 1 ? base : `${base}&page=${page}`;
}

function titleFromSlug(slug) {
  return slug
    .replace(/-\d+$/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function cleanJobTitle(title, slug) {
  const t = (title || '').trim();
  if (!t || t.length > 120 || /posted on|per month|\$\d|PHP/i.test(t)) {
    return titleFromSlug(slug);
  }
  return t.split(/\s{2,}|•/)[0].trim() || titleFromSlug(slug);
}

export function parsePostedDate(text) {
  const lower = (text || '').toLowerCase();
  const today = new Date().toISOString().slice(0, 10);

  const postedOn = text?.match(/posted on (\d{4}-\d{2}-\d{2})/i);
  if (postedOn) {
    if (postedOn[1] === today) return { score: 100, label: 'Today' };
    const days = Math.floor((Date.now() - new Date(postedOn[1]).getTime()) / 86400000);
    if (days === 1) return { score: 75, label: 'Yesterday' };
    if (days <= 7) return { score: 50, label: `${days}d ago` };
    return { score: 10, label: postedOn[1] };
  }

  if (/posted\s+today|\btoday\b|hours?\s+ago|\d+\s*h\s+ago/i.test(lower)) {
    return { score: 100, label: 'Today' };
  }
  if (/yesterday|1\s+day\s+ago/i.test(lower)) return { score: 75, label: 'Yesterday' };

  const daysMatch = lower.match(/(\d+)\s+days?\s+ago/i);
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10);
    return { score: Math.max(10, 70 - days * 15), label: `${days}d ago` };
  }
  return { score: 20, label: 'Older' };
}

function numericJobId(job) {
  const fromSlug = job.id?.match(/-(\d+)$/)?.[1];
  return fromSlug || null;
}

function buildApplyUrls(job) {
  const urls = [];
  if (job.url) urls.push(`${job.url.replace(/\/$/, '')}/apply`);
  const numId = numericJobId(job);
  if (numId) {
    urls.push(`https://www.onlinejobs.ph/apply?job_id=${numId}`);
    urls.push(`https://www.onlinejobs.ph/apply?jid=${numId}`);
  }
  return urls;
}

function parseConnectsFromText(text) {
  if (!text) return null;
  const match =
    text.match(/(\d+)\s*apply\s*points?\s*left/i) ||
    text.match(/(\d+)\s*connects?\s*remaining/i) ||
    text.match(/remaining\s*connects?\s*[:\s]*(\d+)/i) ||
    text.match(/(\d+)\s*\/\s*(\d+)\s*connects?/i);
  return match ? parseInt(match[1], 10) : null;
}

export class JobApplicationAgent {
  constructor({ io, onStatusChange }) {
    this.io = io;
    this.onStatusChange = onStatusChange;
    this.browser = null;
    this.context = null;
    this.page = null;
    this.running = false;
    this.stopped = false;
    this.connectsRemaining = null;
    this.status = {
      state: 'idle',
      currentAction: 'Ready to start',
      currentJob: null,
      currentSearch: null,
      connectsRemaining: null,
      jobsAppliedToday: 0,
      totalApplied: 0,
      lastError: null,
      resumeAt: null,
    };
  }

  emit(event, data) {
    this.io?.emit(event, data);
  }

  updateStatus(partial) {
    this.status = { ...this.status, ...partial };
    this.onStatusChange?.(this.status);
    this.emit('status', this.status);
  }

  log(message, { level = 'info', jobTitle, jobUrl } = {}) {
    logActivity({ level, message, jobTitle, jobUrl });
    this.emit('log', { timestamp: new Date().toISOString(), level, message, jobTitle, jobUrl });
  }

  hasConnectsLeft(connects) {
    const n = connects ?? this.connectsRemaining;
    if (n === null) return true;
    return n > MIN_CONNECTS_RESERVE;
  }

  async updateConnects(connects) {
    if (connects === null) return;
    this.connectsRemaining = connects;
    this.updateStatus({ connectsRemaining: connects });
    updateTodayStats({ connectsRemaining: connects });
    this.log(`Apply points remaining: ${connects}`);
  }

  async readConnectsFromCurrentPage() {
    try {
      const text = await this.page.textContent('body');
      const connects = parseConnectsFromText(text);
      if (connects !== null) await this.updateConnects(connects);
      return connects;
    } catch {
      return this.connectsRemaining;
    }
  }

  async stopNoConnects() {
    const resumeAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    setConnectsExhaustedAt(resumeAt);
    updateTodayStats({ connectsRemaining: 0, stoppedReason: 'no_connects' });
    this.updateStatus({
      state: 'stopped_no_connects',
      currentAction: 'Apply points at zero — auto-resume in 24 hours',
      connectsRemaining: 0,
      resumeAt,
    });
    this.log('Apply points at zero — stopping. Auto-resume in 24h.', { level: 'warn' });
  }

  async start() {
    if (this.running) return;
    this.running = true;
    this.stopped = false;

    const stats = getTodayStats();
    this.updateStatus({ state: 'starting', currentAction: 'Launching browser', jobsAppliedToday: stats.jobs_applied });

    try {
      await this.launchBrowser();
      await this.login();
      await this.runApplicationLoop();
    } catch (err) {
      this.log(`Agent error: ${err.message}`, { level: 'error' });
      this.updateStatus({ state: 'error', currentAction: 'Stopped due to error', lastError: err.message });
    } finally {
      await this.cleanup();
      this.running = false;
      if (this.status.state !== 'stopped_no_connects' && this.status.state !== 'error') {
        this.updateStatus({ state: 'idle', currentAction: 'Finished' });
      }
    }
  }

  stop() {
    this.stopped = true;
    this.log('Stop requested', { level: 'warn' });
    this.updateStatus({ state: 'stopping', currentAction: 'Stopping...' });
  }

  async launchBrowser() {
    this.log('Launching browser');
    this.browser = await chromium.launch({
      headless: process.env.HEADLESS !== 'false',
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });
    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 900 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      locale: 'en-US',
      timezoneId: 'Asia/Manila',
    });
    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(45000);
  }

  async waitForLoginForm() {
    const selectors = [
      'input[name="info[email]"]',
      'input#login_username',
      'input[name="email"]',
      'input[type="email"]',
      'input[autocomplete="email"]',
    ];

    for (const sel of selectors) {
      const el = this.page.locator(sel).first();
      if (await el.isVisible({ timeout: 8000 }).catch(() => false)) return el;
    }

    // v2 Next.js login hydrates after initial paint
    await this.page.waitForTimeout(3000);
    for (const sel of selectors) {
      const el = this.page.locator(sel).first();
      await el.waitFor({ state: 'visible', timeout: 15000 }).catch(() => null);
      if (await el.isVisible().catch(() => false)) return el;
    }

    throw new Error('Login form not found — page may be blocked or still loading');
  }

  async fillLoginForm(email, password) {
    const emailInput = await this.waitForLoginForm();

    const passwordInput = this.page
      .locator('input[name="info[password]"], input#login_password, input[name="password"], input[type="password"]')
      .first();

    await emailInput.click();
    await emailInput.fill(email);
    await passwordInput.waitFor({ state: 'visible', timeout: 15000 });
    await passwordInput.click();
    await passwordInput.fill(password);

    const filled = await this.page.evaluate(() => {
      const emailEl =
        document.querySelector('input[name="info[email]"], input#login_username, input[name="email"], input[type="email"]');
      const passEl =
        document.querySelector('input[name="info[password]"], input#login_password, input[name="password"], input[type="password"]');
      return {
        email: emailEl?.value || '',
        hasPassword: !!passEl?.value,
      };
    });

    if (!filled.email || !filled.hasPassword) {
      throw new Error('Login form fields not filled — page may not have loaded');
    }
  }

  async submitLoginForm() {
    const loginBtn = this.page
      .locator(
        'button[name="login"], button:has-text("Login"), button:has-text("Log in"), button[type="submit"], input[type="submit"]',
      )
      .first();

    await loginBtn.waitFor({ state: 'visible', timeout: 15000 });
    await Promise.all([
      this.page.waitForURL((url) => !url.href.includes('/login'), { timeout: 45000 }),
      loginBtn.click(),
    ]).catch(async () => {
      await loginBtn.click();
      await this.page.waitForTimeout(4000);
    });
  }

  async loginOnWww(email, password) {
    this.log('Opening www login page');
    await this.page.goto(WWW_LOGIN_URL, { waitUntil: 'load', timeout: 90000 });
    await this.page.waitForLoadState('domcontentloaded').catch(() => {});
    await this.page.waitForTimeout(2000);

    if (!this.page.url().includes('/login')) {
      this.log(`Already logged in on www → ${this.page.url()}`);
      return true;
    }

    await this.fillLoginForm(email, password);
    this.log('Submitting www login');
    await this.submitLoginForm();

    if (this.page.url().includes('/login')) {
      return false;
    }

    this.log(`www login successful → ${this.page.url()}`);
    return true;
  }

  async loginOnV2(email, password) {
    this.log('Opening v2 login page');
    await this.page.goto(V2_LOGIN_URL, { waitUntil: 'load', timeout: 90000 });
    await this.page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await this.page.waitForTimeout(3000);

    if (!this.page.url().includes('/login')) {
      this.log(`Already logged in on v2 → ${this.page.url()}`);
      return true;
    }

    await this.fillLoginForm(email, password);
    this.log('Submitting v2 login');
    await this.submitLoginForm();

    if (this.page.url().includes('/login')) {
      return false;
    }

    this.log(`v2 login successful → ${this.page.url()}`);
    return true;
  }

  async login() {
    const email = process.env.OJ_EMAIL;
    const password = process.env.OJ_PASSWORD;
    if (!email || !password) throw new Error('OJ_EMAIL and OJ_PASSWORD must be set in .env');

    this.updateStatus({ state: 'logging_in', currentAction: 'Logging in to OnlineJobs.ph' });

    // www login is static HTML and more reliable in headless Docker than v2 Next.js
    let ok = await this.loginOnWww(email, password).catch((err) => {
      this.log(`www login attempt failed: ${err.message}`, { level: 'warn' });
      return false;
    });

    if (!ok) {
      ok = await this.loginOnV2(email, password).catch((err) => {
        this.log(`v2 login attempt failed: ${err.message}`, { level: 'warn' });
        return false;
      });
    }

    if (!ok) {
      throw new Error('Login failed on both www and v2 — check credentials or site availability');
    }

    await this.ensureWwwSession(email, password);
    await pause('short');
  }

  async ensureWwwSession(email, password) {
    email = email || process.env.OJ_EMAIL;
    password = password || process.env.OJ_PASSWORD;

    this.log('Syncing www.onlinejobs.ph session');
    await this.page.goto('https://www.onlinejobs.ph/jobseekers/jobsearch?jobkeyword=React', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await this.page.waitForTimeout(2000);

    const loggedIn = await this.page.evaluate(() => {
      const navLogin = document.querySelector('a[href="/login"]');
      const navText = navLogin?.textContent?.toLowerCase() || '';
      return !navText.includes('log in');
    });

    if (loggedIn) {
      this.log('www session active');
      return;
    }

    this.log('Logging in on www.onlinejobs.ph');
    const ok = await this.loginOnWww(email, password).catch(() => false);
    if (!ok) {
      throw new Error('www.onlinejobs.ph login failed — cannot access apply buttons');
    }
  }

  async readJobPageState() {
    return this.page.evaluate(() => {
      const text = document.body.innerText || '';
      return {
        needsLogin: /please\s+login.*apply for this job/i.test(text),
        alreadyApplied: /already applied|you have applied|application sent/i.test(text),
        applyHref: [...document.querySelectorAll('a[href]')]
          .map((a) => ({ href: a.href, text: (a.textContent || '').trim() }))
          .find((x) => /apply for this job/i.test(x.text) || /\/apply/i.test(x.href))?.href,
        jobNumericId:
          document.querySelector('[data-jobid]')?.getAttribute('data-jobid') ||
          document.querySelector('#jobIdText')?.value ||
          null,
      };
    });
  }

  async runApplicationLoop() {
    const keywords = getSearchKeywords();
    this.log(`Searching: ${keywords.join(', ')}`);

    let totalApplied = 0;

    for (const keyword of keywords) {
      if (this.stopped) break;
      if (!this.hasConnectsLeft()) {
        await this.stopNoConnects();
        return;
      }

      for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum++) {
        if (this.stopped) break;
        if (!this.hasConnectsLeft()) {
          await this.stopNoConnects();
          return;
        }

        const pageUrl = buildSearchUrl(keyword, pageNum);
        this.updateStatus({
          state: 'searching',
          currentAction: `Searching "${keyword}" page ${pageNum}`,
          currentSearch: keyword,
        });
        this.log(`Opening search: ${pageUrl}`);

        await this.page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await this.page.waitForTimeout(2000);

        // Stay on search page — do NOT navigate to v2 dashboard
        const currentUrl = this.page.url();
        if (currentUrl.includes('v2.onlinejobs.ph/jobseekers') && !currentUrl.includes('jobsearch')) {
          this.log('Redirected to dashboard — going back to search', { level: 'warn' });
          await this.page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
          await pause('short');
        }

        const jobs = await this.collectJobLinks(keyword);
        this.log(`Found ${jobs.length} jobs on page ${pageNum}`);

        if (jobs.length === 0) break;

        for (const job of jobs) {
          if (this.stopped) break;
          if (!this.hasConnectsLeft()) {
            await this.stopNoConnects();
            return;
          }
          if (isJobApplied(job.id)) {
            this.log(`Skip: ${job.title}`, { jobTitle: job.title });
            continue;
          }

          try {
            if (await this.applyToJob(job)) {
              totalApplied++;
              this.updateStatus({ jobsAppliedToday: getTodayStats().jobs_applied });
              this.emit('applied', null);
            }
          } catch (err) {
            this.log(`Failed: ${job.title} — ${err.message}`, { level: 'error', jobTitle: job.title, jobUrl: job.url });
          }

          await pause('between_jobs');
        }
      }
    }

    this.log(`Done — applied to ${totalApplied} jobs this session`);
  }

  async collectJobLinks(keyword) {
    const links = await this.page.evaluate(() => {
      const results = [];
      const seen = new Set();

      const pickTitle = (a, slug) => {
        const h = a.querySelector('h4, h3, h2');
        if (h?.textContent?.trim()) return h.textContent.trim();
        const t = a.textContent?.trim() || '';
        if (t.length >= 10 && t.length <= 100 && !/posted on/i.test(t)) return t;
        return slug.replace(/-\d+$/, '').replace(/-/g, ' ');
      };

      for (const a of document.querySelectorAll('a[href*="/jobseekers/job/"]')) {
        const href = a.href || a.getAttribute('href') || '';
        const fullUrl = href.startsWith('http') ? href : `https://www.onlinejobs.ph${href}`;
        const match = fullUrl.match(/\/jobseekers\/job\/([^/?#]+)/);
        if (!match || seen.has(match[1])) continue;
        if (/^(apply|bookmark|see more|back)/i.test(a.textContent?.trim() || '')) continue;

        seen.add(match[1]);
        const card = a.closest('div, article, li, section') || a.parentElement?.parentElement;

        results.push({
          id: match[1],
          url: fullUrl.split('?')[0],
          title: pickTitle(a, match[1]),
          contextText: card?.textContent || '',
        });
      }
      return results;
    });

    return links
      .map((job) => {
        const posted = parsePostedDate(job.contextText);
        return {
          ...job,
          title: cleanJobTitle(job.title, job.id),
          searchKeyword: keyword,
          postedScore: posted.score,
          postedLabel: posted.label,
        };
      })
      .sort((a, b) => b.postedScore - a.postedScore);
  }

  async applyToJob(job) {
    this.updateStatus({
      state: 'applying',
      currentAction: `Opening job: ${job.title}`,
      currentJob: { title: job.title, url: job.url },
      currentSearch: job.searchKeyword,
    });
    this.log(`Clicking job [${job.postedLabel}]: ${job.title}`, { jobTitle: job.title, jobUrl: job.url });

    // Open job detail page on www.onlinejobs.ph
    await this.page.goto(job.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await this.page.waitForTimeout(3000);

    // Scroll to load apply button area
    await this.page.evaluate(() => window.scrollTo(0, 0));
    await this.page.waitForTimeout(500);
    await this.page.evaluate(() => window.scrollTo(0, 400));
    await this.page.waitForTimeout(1000);

    if (this.page.url().includes('v2.onlinejobs.ph/jobseekers') && !this.page.url().includes('/job/')) {
      throw new Error('Redirected away from job page — session issue');
    }

    const pageState = await this.readJobPageState();

    if (pageState.needsLogin) {
      this.log('Job page requires login — refreshing www session', { level: 'warn' });
      await this.ensureWwwSession();
      await this.page.goto(job.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await this.page.waitForTimeout(2500);
    }

    const refreshedState = await this.readJobPageState();
    if (refreshedState.alreadyApplied) {
      this.log(`Skip: already applied — ${job.title}`);
      markJobApplied({
        jobId: job.id,
        jobUrl: job.url,
        jobTitle: job.title,
        subject: '(already applied on site)',
        body: '(skipped)',
        description: '',
        companyName: '',
        searchKeyword: job.searchKeyword,
        postedLabel: job.postedLabel,
        postedScore: job.postedScore,
      });
      return false;
    }

    const jobDetails = await this.page.evaluate(() => {
      const title =
        document.querySelector('h1')?.textContent?.trim() ||
        document.querySelector('.job-title, [class*="job-title"]')?.textContent?.trim() || '';
      const company =
        document.querySelector('[class*="company"], .employer-name, a[href*="/employer/"]')?.textContent?.trim() || '';
      const description =
        document.querySelector(
          '[class*="job-description"], [class*="description"], #job-description, .job-overview, article'
        )?.textContent?.trim() || document.body.innerText.slice(0, 5000);
      const applyHref = [...document.querySelectorAll('a[href]')]
        .map((a) => ({ href: a.href, text: a.textContent?.trim() || '' }))
        .find((x) => /apply/i.test(x.text) || /\/apply/i.test(x.href))?.href;
      return { title, company, description, pageText: document.body.innerText.slice(0, 4000), applyHref };
    });

    const jobTitle = cleanJobTitle(jobDetails.title, job.id) || job.title;
    const posted = parsePostedDate(jobDetails.pageText || job.contextText);

    this.updateStatus({ currentAction: `Writing application for: ${jobTitle}` });
    const { subject, body, mode } = await generateTailoredMessage({
      jobTitle,
      jobDescription: jobDetails.description,
      companyName: jobDetails.company,
    });
    this.log(`Message ready (${mode})`, { jobTitle, jobUrl: job.url });

    // Click green "APPLY FOR THIS JOB" button (or navigate directly to apply URL)
    this.updateStatus({ currentAction: 'Clicking Apply For This Job' });
    const applied = await this.clickApplyButton({
      job,
      knownApplyHref: jobDetails.applyHref || refreshedState.applyHref,
      jobNumericId: refreshedState.jobNumericId || numericJobId(job),
    });
    if (!applied) throw new Error('Apply For This Job button not found');

    await this.page.waitForURL(/\/apply/i, { timeout: 15000 }).catch(() => {});
    await pause('short');

    await this.fillApplicationForm({ subject, body });
    await this.submitApplication();

    markJobApplied({
      jobId: job.id,
      jobUrl: job.url,
      jobTitle,
      subject,
      body,
      description: jobDetails.description,
      companyName: jobDetails.company,
      searchKeyword: job.searchKeyword,
      postedLabel: posted.label,
      postedScore: posted.score,
    });
    incrementJobsApplied();
    this.io?.emit('application', {
      job_title: jobTitle,
      job_url: job.url,
      subject,
      company_name: jobDetails.company,
      search_keyword: job.searchKeyword,
      posted_label: posted.label,
      applied_at: new Date().toISOString(),
    });
    this.log(`Applied: ${jobTitle}`, { jobTitle, jobUrl: job.url });
    return true;
  }

  async isOnApplyForm() {
    const url = this.page.url();
    if (/\/apply/i.test(url)) return true;
    return this.page
      .locator('input[name="subject"], textarea[name="message"], textarea[name="body"]')
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);
  }

  async clickApplyButton({ job, knownApplyHref, jobNumericId }) {
    const tryUrls = [
      knownApplyHref,
      ...buildApplyUrls(job),
      jobNumericId ? `https://www.onlinejobs.ph/apply?job_id=${jobNumericId}` : null,
    ].filter(Boolean);

    for (const url of [...new Set(tryUrls)]) {
      this.log(`Trying apply URL: ${url}`);
      await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await this.page.waitForTimeout(1500);
      if (await this.isOnApplyForm()) return true;
    }

    // Return to job page for button click strategies
    if (job?.url) {
      await this.page.goto(job.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await this.page.waitForTimeout(2000);
    }

    await this.page.evaluate(() => window.scrollTo(0, 300));

    const strategies = [
      () => this.page.locator('a.btn, button.btn, input.btn').filter({ hasText: /apply for this job/i }),
      () => this.page.getByRole('link', { name: /apply for this job/i }),
      () => this.page.getByRole('button', { name: /apply for this job/i }),
      () => this.page.getByRole('link', { name: /apply now/i }),
      () => this.page.locator('a, button, input[type="submit"]').filter({ hasText: /apply for this job/i }),
      () => this.page.locator('a[href*="/apply"]'),
    ];

    for (const getLocator of strategies) {
      try {
        const el = getLocator().first();
        await el.waitFor({ state: 'visible', timeout: 5000 });
        await el.scrollIntoViewIfNeeded();
        await fastClick(el);
        await this.page.waitForTimeout(2000);
        if (await this.isOnApplyForm()) return true;
      } catch {
        /* try next */
      }
    }

    const href = await this.page.evaluate(() => {
      for (const a of document.querySelectorAll('a')) {
        const text = (a.textContent || '').toLowerCase();
        const h = (a.href || '').toLowerCase();
        if (text.includes('apply for this job') || text.includes('apply now') || h.includes('/apply')) {
          return a.href;
        }
      }
      return null;
    });

    if (href) {
      await this.page.goto(href, { waitUntil: 'domcontentloaded', timeout: 30000 });
      return this.isOnApplyForm();
    }

    return false;
  }

  async fillApplicationForm({ subject, body }) {
    this.updateStatus({ currentAction: 'Filling application form' });
    await this.page.waitForLoadState('domcontentloaded');

    // Read apply points from form page
    await this.readConnectsFromCurrentPage();

    // Subject
    for (const sel of [
      'input[name="subject"]',
      'input#subject',
      'label:has-text("Subject") + input',
      'input[placeholder*="subject" i]',
    ]) {
      const el = this.page.locator(sel).first();
      if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
        await fastFill(el, subject);
        break;
      }
    }

    // Message
    for (const sel of [
      'textarea[name="message"]',
      'textarea#message',
      'textarea[name="body"]',
      'label:has-text("Message") + textarea',
      'textarea',
    ]) {
      const el = this.page.locator(sel).first();
      if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
        await fastFill(el, body);
        break;
      }
    }

    // Contact info — only fill if empty (site often pre-fills email)
    for (const sel of ['textarea[name="contact"]', 'textarea#contact', 'label:has-text("Contact") + textarea']) {
      const el = this.page.locator(sel).first();
      if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
        const cur = await el.inputValue().catch(() => '');
        if (!cur?.trim()) await fastFill(el, process.env.OJ_EMAIL || 'contact@email.com');
        break;
      }
    }
  }

  async submitApplication() {
    this.updateStatus({ currentAction: 'Clicking Send Email' });

    const selectors = [
      'button:has-text("SEND EMAIL")',
      'input[value*="SEND EMAIL" i]',
      'button:has-text("Send Email")',
      'input[value*="Send Email" i]',
      'button:has-text("Send")',
      'button[type="submit"]',
    ];

    for (const sel of selectors) {
      const el = this.page.locator(sel).first();
      if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
        await Promise.all([
          this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
          fastClick(el),
        ]);
        await pause('short');
        await this.readConnectsFromCurrentPage();

        if (this.connectsRemaining !== null && this.connectsRemaining <= MIN_CONNECTS_RESERVE) {
          await this.stopNoConnects();
        }
        return;
      }
    }
    throw new Error('Send Email button not found');
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
      this.page = null;
    }
  }
}

export default JobApplicationAgent;
