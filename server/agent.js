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

const LOGIN_URL = 'https://v2.onlinejobs.ph/login';
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
    this.browser = await chromium.launch({ headless: process.env.HEADLESS !== 'false' });
    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 900 },
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    this.page = await this.context.newPage();
  }

  async login() {
    const email = process.env.OJ_EMAIL;
    const password = process.env.OJ_PASSWORD;
    if (!email || !password) throw new Error('OJ_EMAIL and OJ_PASSWORD must be set in .env');

    this.updateStatus({ state: 'logging_in', currentAction: 'Logging in' });
    await this.page.goto(LOGIN_URL, { waitUntil: 'networkidle', timeout: 60000 });

    const emailInput = this.page.locator('input[type="email"], input[name="email"], input#email').first();
    const passwordInput = this.page.locator('input[type="password"], input[name="password"]').first();

    await emailInput.waitFor({ state: 'visible', timeout: 15000 });
    await emailInput.fill(email);
    await passwordInput.fill(password);

    await Promise.all([
      this.page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 }).catch(() => {}),
      this.page.locator('button[type="submit"], button:has-text("Log in"), button:has-text("Login")').first().click(),
    ]);

    if (this.page.url().includes('/login')) {
      throw new Error('Login failed — check credentials');
    }

    this.log('Login successful');
    await pause('short');
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

        await this.page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 60000 });
        await pause('page_load');

        // Stay on search page — do NOT navigate to v2 dashboard
        const currentUrl = this.page.url();
        if (currentUrl.includes('v2.onlinejobs.ph/jobseekers') && !currentUrl.includes('jobsearch')) {
          this.log('Redirected to dashboard — going back to search', { level: 'warn' });
          await this.page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 60000 });
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

      // Job cards: title links to /jobseekers/job/slug-id
      const anchors = document.querySelectorAll('a[href*="/jobseekers/job/"]');

      for (const a of anchors) {
        const href = a.href || a.getAttribute('href') || '';
        const fullUrl = href.startsWith('http') ? href : `https://www.onlinejobs.ph${href}`;
        const match = fullUrl.match(/\/jobseekers\/job\/([^/?#]+)/);
        if (!match || seen.has(match[1])) continue;

        const title = a.textContent?.trim() || '';
        // Skip short/non-title links (nav, breadcrumbs)
        if (title.length < 10) continue;
        // Skip if looks like a button not a title
        if (/^(apply|bookmark|see more|back)/i.test(title)) continue;

        seen.add(match[1]);

        const card = a.closest('div[class], article, li, section') || a.parentElement?.parentElement;
        const contextText = card?.textContent || a.textContent || '';

        results.push({
          id: match[1],
          url: fullUrl.split('?')[0],
          title,
          contextText,
        });
      }

      // Deduplicate by keeping longest title per id
      const byId = {};
      for (const r of results) {
        if (!byId[r.id] || r.title.length > byId[r.id].title.length) {
          byId[r.id] = r;
        }
      }
      return Object.values(byId);
    });

    return links
      .map((job) => {
        const posted = parsePostedDate(job.contextText);
        return { ...job, searchKeyword: keyword, postedScore: posted.score, postedLabel: posted.label };
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
    await this.page.goto(job.url, { waitUntil: 'networkidle', timeout: 60000 });
    await pause('page_load');

    if (this.page.url().includes('v2.onlinejobs.ph/jobseekers') && !this.page.url().includes('/job/')) {
      throw new Error('Redirected away from job page — session issue');
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
      return { title, company, description, pageText: document.body.innerText.slice(0, 4000) };
    });

    const jobTitle = jobDetails.title || job.title;
    const posted = parsePostedDate(jobDetails.pageText || job.contextText);

    this.updateStatus({ currentAction: `Writing application for: ${jobTitle}` });
    const { subject, body, mode } = await generateTailoredMessage({
      jobTitle,
      jobDescription: jobDetails.description,
      companyName: jobDetails.company,
    });
    this.log(`Message ready (${mode})`, { jobTitle, jobUrl: job.url });

    // Click green "APPLY FOR THIS JOB" button
    this.updateStatus({ currentAction: 'Clicking Apply For This Job' });
    const applied = await this.clickApplyButton();
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

  async clickApplyButton() {
    const selectors = [
      'a:has-text("APPLY FOR THIS JOB")',
      'button:has-text("APPLY FOR THIS JOB")',
      'a:has-text("Apply for this job")',
      'button:has-text("Apply for this job")',
      'a:has-text("Apply For This Job")',
      'button:has-text("Apply For This Job")',
      'a:has-text("Apply Now")',
      'a[href*="/apply"]',
    ];

    for (const sel of selectors) {
      const el = this.page.locator(sel).first();
      if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
        await fastClick(el);
        return true;
      }
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
          this.page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }).catch(() => {}),
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
