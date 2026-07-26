import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const DB_PATH = join(DATA_DIR, 'store.json');

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const DEFAULT_STORE = {
  applied_jobs: [],
  daily_stats: {},
  activity_log: [],
  settings: { connects_exhausted_at: null },
};

function load() {
  if (!existsSync(DB_PATH)) return structuredClone(DEFAULT_STORE);
  const data = JSON.parse(readFileSync(DB_PATH, 'utf8'));
  return { ...structuredClone(DEFAULT_STORE), ...data, settings: { ...DEFAULT_STORE.settings, ...data.settings } };
}

function save(data) {
  writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function isJobApplied(jobId) {
  return load().applied_jobs.some((j) => j.job_id === jobId);
}

export function markJobApplied({
  jobId,
  jobUrl,
  jobTitle,
  subject,
  body,
  description,
  companyName,
  searchKeyword,
  postedLabel,
  postedScore,
}) {
  const data = load();
  if (data.applied_jobs.some((j) => j.job_id === jobId)) return;

  data.applied_jobs.push({
    job_id: jobId,
    job_url: jobUrl,
    job_title: jobTitle,
    company_name: companyName || null,
    subject,
    body,
    description: description?.slice(0, 2000) || null,
    search_keyword: searchKeyword || null,
    posted_label: postedLabel || null,
    posted_score: postedScore ?? 0,
    applied_at: new Date().toISOString(),
    status: 'applied',
  });
  save(data);
}

export function getAppliedCount() {
  return load().applied_jobs.length;
}

export function getTodayStats() {
  const data = load();
  const d = today();
  if (!data.daily_stats[d]) {
    data.daily_stats[d] = { connects_remaining: null, jobs_applied: 0, stopped_reason: null };
    save(data);
  }
  return { date: d, ...data.daily_stats[d] };
}

export function updateTodayStats({ connectsRemaining, jobsApplied, stoppedReason }) {
  const data = load();
  const d = today();
  if (!data.daily_stats[d]) {
    data.daily_stats[d] = { connects_remaining: null, jobs_applied: 0, stopped_reason: null };
  }
  const s = data.daily_stats[d];
  if (connectsRemaining !== undefined) s.connects_remaining = connectsRemaining;
  if (jobsApplied !== undefined) s.jobs_applied = jobsApplied;
  if (stoppedReason !== undefined) s.stopped_reason = stoppedReason;
  save(data);
}

export function incrementJobsApplied() {
  const data = load();
  const d = today();
  if (!data.daily_stats[d]) {
    data.daily_stats[d] = { connects_remaining: null, jobs_applied: 0, stopped_reason: null };
  }
  data.daily_stats[d].jobs_applied += 1;
  save(data);
}

export function setConnectsExhaustedAt(iso) {
  const data = load();
  data.settings.connects_exhausted_at = iso;
  save(data);
}

export function getConnectsExhaustedAt() {
  return load().settings.connects_exhausted_at;
}

export function clearConnectsExhausted() {
  const data = load();
  data.settings.connects_exhausted_at = null;
  save(data);
}

export function logActivity({ level = 'info', message, jobTitle, jobUrl }) {
  const data = load();
  data.activity_log.push({
    timestamp: new Date().toISOString(),
    level,
    message,
    job_title: jobTitle ?? null,
    job_url: jobUrl ?? null,
  });
  if (data.activity_log.length > 500) {
    data.activity_log = data.activity_log.slice(-500);
  }
  save(data);
}

export function getRecentLogs(limit = 100) {
  return load().activity_log.slice(-limit);
}

export function getAppliedJobs(limit = 200) {
  return [...load().applied_jobs].reverse().slice(0, limit);
}

export function getAnalytics() {
  const jobs = load().applied_jobs;
  const byDay = {};
  const byKeyword = {};
  const byCompany = {};

  for (const job of jobs) {
    const day = job.applied_at?.slice(0, 10) || 'unknown';
    byDay[day] = (byDay[day] || 0) + 1;

    const kw = job.search_keyword || 'Other';
    byKeyword[kw] = (byKeyword[kw] || 0) + 1;

    const co = job.company_name || 'Unknown';
    byCompany[co] = (byCompany[co] || 0) + 1;
  }

  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    last7Days.push({ date: key, count: byDay[key] || 0 });
  }

  return {
    total: jobs.length,
    today: getTodayStats().jobs_applied,
    byDay: last7Days,
    byKeyword: Object.entries(byKeyword).map(([name, count]) => ({ name, count })),
    recentTodayJobs: jobs.filter((j) => j.posted_label === 'Today').length,
  };
}
