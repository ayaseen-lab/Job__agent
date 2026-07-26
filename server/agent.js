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
import { humanDelay, humanScroll, humanType, humanClick } from './humanDelay.js';

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
  const now = new Date();

  if (/posted\s+today|\btoday\b|hours?\s+ago|\d+\s*h\s+ago/i.test(lower)) {
    return { score: 100, label: 'Today' };
  }
  if (/yesterday|1\s+day\s+ago/i.test(lower)) {
    return { score: 75, label: 'Yesterday' };
  }
  const daysMatch = lower.match(/(\d+)\s+days?\s+ago/i);
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10);
    return { score: Math.max(10, 70 - days * 15), label: `${days}d ago` };
  }
  const weeksMatch = lower.match(/(\d+)\s+weeks?\s+ago/i);
  if (weeksMatch) {
    return { score: 5, label: `${weeksMatch[1]}w ago` };
  }
  return { score: 20, label: 'Older' };
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

  async wait(type = 'medium') {
    await humanDelay(type, (msg) => this.log(msg));
  }

  hasConnectsLeft(connects) {
    if (connects === null) return true;
    return connects > MIN_CONNECTS_RESERVE;
  }

  async stopNoConnects() {
    const resumeAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    setConnectsExhaustedAt(resumeAt);
    updateTodayStats({ connectsRemaining: 0, stoppedReason: 'no_connects' });
    this.updateStatus({
      state: 'stopped_no_connects',
      currentAction: 'Connects exhausted — auto-resume in 24 hours',
      connectsRemaining: 0,
      resumeAt,
    });
    this.log('Connects at zero — agent stopped. Will auto-resume in 24 hours.', { level: 'warn' });
  }

  async start() {
    if (this.running) return;
    this.running = true;
    this.stopped = false;

    const stats = getTodayStats();
    this.updateStatus({
      state: 'starting',
      currentAction: 'Launching browser',
      jobsAppliedToday: stats.jobs_applied,
    });

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
    this.log('Stop requested by user', { level: 'warn' });
    this.updateStatus({ state: 'stopping', currentAction: 'Stopping...' });
  }

  async launchBrowser() {
    this.log('Launching Chromium browser');
    this.browser = await chromium.launch({
      headless: process.env.HEADLESS !== 'false',
      slowMo: 80,
    });
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

    this.updateStatus({ state: 'logging_in', currentAction: 'Logging in to OnlineJobs.ph' });
    await this.page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await this.wait('page_read');

    const emailInput = this.page.locator('input[type="email"], input[name="email"], input#email').first();
    const passwordInput = this.page.locator('input[type="password"], input[name="password"]').first();

    await emailInput.waitFor({ state: 'visible', timeout: 15000 });
    await humanType(this.page, emailInput, email);
    await this.wait('form_field');
    await humanType(this.page, passwordInput, password);
    await this.wait('before_click');

    const submitBtn = this.page.locator('button[type="submit"], button:has-text("Log in"), button:has-text("Login")').first();
    await Promise.all([
      this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {}),
      humanClick(this.page, submitBtn),
    ]);
    await this.wait('after_login');

    if (this.page.url().includes('/login')) {
      throw new Error('Login failed — check credentials in .env');
    }

    this.log('Login successful');
    await this.readConnects();
  }

  async readConnects() {
    try {
      await this.page.goto('https://www.onlinejobs.ph/jobseekers', {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      await this.wait('short');
      await humanScroll(this.page);

      const pageText = await this.page.textContent('body');
      const match =
        pageText?.match(/(\d+)\s*connects?\s*remaining/i) ||
        pageText?.match(/remaining\s*connects?\s*[:\s]*(\d+)/i) ||
        pageText?.match(/(\d+)\s*\/\s*(\d+)\s*connects?/i);

      const connects = match ? parseInt(match[1], 10) : null;
      if (connects !== null) {
        this.updateStatus({ connectsRemaining: connects });
        updateTodayStats({ connectsRemaining: connects });
        this.log(`Connects remaining: ${connects}`);
      }
      return connects;
    } catch {
      return null;
    }
  }

  async runApplicationLoop() {
    const keywords = getSearchKeywords();
    this.log(`Search targets: ${keywords.join(', ')}`);

    const allJobs = [];

    for (const keyword of keywords) {
      if (this.stopped) break;

      for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum++) {
        if (this.stopped) break;

        const connects = await this.readConnects();
        if (!this.hasConnectsLeft(connects)) {
          await this.stopNoConnects();
          return;
        }

        const pageUrl = buildSearchUrl(keyword, pageNum);
        this.updateStatus({
          state: 'searching',
          currentAction: `Searching "${keyword}" — page ${pageNum}`,
          currentSearch: keyword,
        });
        this.log(`Searching [${keyword}] page ${pageNum}`);

        await this.page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await this.wait('page_read');
        await humanScroll(this.page);

        const jobs = await this.collectJobLinks(keyword);
        if (jobs.length === 0) break;
        allJobs.push(...jobs);
        await this.wait('medium');
      }
    }

    const unique = new Map();
    for (const job of allJobs) {
      if (!unique.has(job.id)) unique.set(job.id, job);
    }

    const sorted = [...unique.values()].sort((a, b) => b.postedScore - a.postedScore);
    this.log(`Found ${sorted.length} unique jobs — prioritizing today's postings first`);

    let applied = 0;
    for (const job of sorted) {
      if (this.stopped) break;

      const connectsNow = await this.readConnects();
      if (!this.hasConnectsLeft(connectsNow)) {
        await this.stopNoConnects();
        return;
      }

      if (isJobApplied(job.id)) {
        this.log(`Skip (already applied): ${job.title}`, { jobTitle: job.title, jobUrl: job.url });
        continue;
      }

      try {
        if (await this.applyToJob(job)) {
          applied++;
          const stats = getTodayStats();
          this.updateStatus({ jobsAppliedToday: stats.jobs_applied });
          this.emit('applied', null);
        }
      } catch (err) {
        this.log(`Failed: ${job.title} — ${err.message}`, { level: 'error', jobTitle: job.title, jobUrl: job.url });
      }

      await this.wait('between_jobs');
    }

    this.log(`Session complete — applied to ${applied} jobs`);
  }

  async collectJobLinks(keyword) {
    const links = await this.page.evaluate(() => {
      const results = [];
      const seen = new Set();
      for (const a of document.querySelectorAll('a[href*="/jobseekers/job/"]')) {
        const match = a.href.match(/\/jobseekers\/job\/([^/?#]+)/);
        if (!match || seen.has(match[1])) continue;
        seen.add(match[1]);
        const parent = a.closest('div, li, article, tr') || a.parentElement;
        const contextText = parent?.textContent || '';
        const title =
          a.querySelector('h4, h3, h2')?.textContent?.trim() ||
          a.textContent?.trim() ||
          match[1].replace(/-/g, ' ');
        if (title.length < 3) continue;
        results.push({ id: match[1], url: a.href.split('?')[0], title, contextText });
      }
      return results;
    });

    return links.map((job) => {
      const posted = parsePostedDate(job.contextText);
      return { ...job, searchKeyword: keyword, postedScore: posted.score, postedLabel: posted.label };
    });
  }

  async applyToJob(job) {
    this.updateStatus({
      state: 'applying',
      currentAction: `Reading: ${job.title} [${job.postedLabel}]`,
      currentJob: { title: job.title, url: job.url },
      currentSearch: job.searchKeyword,
    });
    this.log(`Opening [${job.postedLabel}] ${job.title}`, { jobTitle: job.title, jobUrl: job.url });

    await this.page.goto(job.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await this.wait('page_read');
    await humanScroll(this.page);
    await this.wait('medium');

    const jobDetails = await this.page.evaluate(() => {
      const title = document.querySelector('h1, .job-title, [class*="job-title"]')?.textContent?.trim() || '';
      const company =
        document.querySelector('[class*="company"], .employer-name, a[href*="/employer/"]')?.textContent?.trim() || '';
      const description =
        document.querySelector('.job-description, [class*="job-description"], [class*="description"], article')
          ?.textContent?.trim() || document.body.innerText.slice(0, 5000);
      return { title, company, description, pageText: document.body.innerText.slice(0, 3000) };
    });

    const posted = parsePostedDate(jobDetails.pageText);
    const jobTitle = jobDetails.title || job.title;

    this.updateStatus({ currentAction: `Writing winning application for: ${jobTitle}` });
    const { subject, body, mode } = await generateTailoredMessage({
      jobTitle,
      jobDescription: jobDetails.description,
      companyName: jobDetails.company,
    });
    this.log(`Message ready (${mode})`, { jobTitle, jobUrl: job.url });
    await this.wait('form_field');

    if (!(await this.clickApplyButton())) throw new Error('Apply button not found');

    await this.wait('page_read');
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
    this.log(`Applied successfully: ${jobTitle}`, { jobTitle, jobUrl: job.url });
    await this.wait('after_submit');
    return true;
  }

  async clickApplyButton() {
    const selectors = [
      'a:has-text("Apply for this job")',
      'button:has-text("Apply for this job")',
      'a:has-text("Apply Now")',
      'button:has-text("Apply Now")',
      'a[href*="/apply"]',
    ];
    for (const sel of selectors) {
      const el = this.page.locator(sel).first();
      if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
        await this.wait('before_click');
        await humanClick(this.page, el);
        return true;
      }
    }
    return false;
  }

  async fillApplicationForm({ subject, body }) {
    this.updateStatus({ currentAction: 'Typing application (human speed)' });
    await this.page.waitForLoadState('domcontentloaded');
    await this.wait('form_field');

    for (const sel of ['input[name="subject"]', 'input#subject', 'input[placeholder*="subject" i]']) {
      const el = this.page.locator(sel).first();
      if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
        await humanType(this.page, el, subject);
        await this.wait('form_field');
        break;
      }
    }

    for (const sel of ['textarea[name="message"]', 'textarea#message', 'textarea']) {
      const el = this.page.locator(sel).first();
      if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
        await humanType(this.page, el, body);
        await this.wait('form_field');
        break;
      }
    }

    for (const field of [
      { sels: ['input[name="name"]', 'input#name'], val: 'Applicant' },
      { sels: ['input[name="phone"]', 'input[type="tel"]'], val: 'N/A' },
    ]) {
      for (const sel of field.sels) {
        const el = this.page.locator(sel).first();
        if (await el.isVisible({ timeout: 800 }).catch(() => false)) {
          const cur = await el.inputValue().catch(() => '');
          if (!cur?.trim()) await humanType(this.page, el, field.val);
          break;
        }
      }
    }
  }

  async submitApplication() {
    this.updateStatus({ currentAction: 'Sending application...' });
    await this.wait('medium');

    for (const sel of ['button:has-text("Send Email")', 'input[value*="Send Email" i]', 'button[type="submit"]']) {
      const el = this.page.locator(sel).first();
      if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
        await this.wait('before_click');
        await Promise.all([
          this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
          humanClick(this.page, el),
        ]);
        await this.readConnects();
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
