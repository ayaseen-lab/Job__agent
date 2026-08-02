import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cron from 'node-cron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import JobApplicationAgent from './agent.js';
import {
  getTodayStats,
  getRecentLogs,
  getAppliedJobs,
  getAppliedCount,
  getAnalytics,
  updateTodayStats,
  logActivity,
  getConnectsExhaustedAt,
  clearConnectsExhausted,
  getUserStopped,
  setUserStopped,
  clearUserStopped,
} from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3847;

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

app.use(express.json());
app.use(express.static(join(__dirname, '..', 'public')));

let agent = null;
const bootUserStopped = getUserStopped();
let agentStatus = {
  state: bootUserStopped ? 'stopped_by_user' : 'idle',
  currentAction: bootUserStopped ? 'Stopped — click Start to resume' : 'Ready',
  currentJob: null,
  currentSearch: null,
  connectsRemaining: null,
  jobsAppliedToday: 0,
  totalApplied: getAppliedCount(),
  resumeAt: getConnectsExhaustedAt(),
  lastError: null,
  stoppedByUser: bootUserStopped,
  canStart: true,
};

function emitStatus(extra = {}) {
  const today = getTodayStats();
  const payload = {
    ...agentStatus,
    ...extra,
    jobsAppliedToday: today.jobs_applied,
    connectsRemaining: agentStatus.connectsRemaining ?? today.connects_remaining,
    stoppedByUser: getUserStopped(),
    canStart: !agent?.running,
    totalApplied: getAppliedCount(),
    resumeAt: getConnectsExhaustedAt(),
  };
  agentStatus = { ...agentStatus, ...payload };
  io.emit('status', payload);
  return payload;
}

function startAgent(source = 'manual') {
  if (agent?.running) return false;
  if (getUserStopped()) return false;

  logActivity({ message: `Agent started (${source})` });
  agent = new JobApplicationAgent({
    io,
    onStatusChange: (status) => {
      const today = getTodayStats();
      agentStatus = {
        ...agentStatus,
        ...status,
        totalApplied: getAppliedCount(),
        jobsAppliedToday: today.jobs_applied,
        stoppedByUser: getUserStopped(),
        canStart: false,
      };
    },
  });

  agent.start().then(() => {
    emitStatus();
    io.emit('applied', getAppliedJobs(200));
    io.emit('analytics', getAnalytics());
  });
  return true;
}

app.get('/api/status', (_req, res) => {
  const today = getTodayStats();
  res.json({
    ...agentStatus,
    jobsAppliedToday: today.jobs_applied,
    connectsRemaining: agentStatus.connectsRemaining ?? today.connects_remaining,
    stoppedReason: today.stopped_reason,
    totalApplied: getAppliedCount(),
    resumeAt: getConnectsExhaustedAt(),
    stoppedByUser: getUserStopped(),
    canStart: !agent?.running,
    searchKeywords: (process.env.JOB_KEYWORDS || 'React,Software Engineer,AI Engineer,Backend Developer').split(','),
  });
});

app.get('/api/logs', (_req, res) => res.json(getRecentLogs(150)));
app.get('/api/applied', (_req, res) => res.json(getAppliedJobs(200)));
app.get('/api/analytics', (_req, res) => res.json(getAnalytics()));

app.post('/api/start', (_req, res) => {
  if (agent?.running) return res.status(409).json({ error: 'Agent is already running' });
  clearUserStopped();
  clearConnectsExhausted();
  agentStatus.resumeAt = null;
  agentStatus.stoppedByUser = false;
  startAgent('manual');
  emitStatus({ state: 'starting', currentAction: 'Starting...' });
  res.json({ ok: true });
});

app.post('/api/stop', (_req, res) => {
  setUserStopped(true);
  if (agent) {
    agent.stop();
  }
  agentStatus = {
    ...agentStatus,
    state: 'stopped_by_user',
    currentAction: 'Stopped — click Start to resume',
    currentJob: null,
    currentSearch: null,
    stoppedByUser: true,
    canStart: true,
    totalApplied: getAppliedCount(),
  };
  emitStatus();
  logActivity({ message: 'Agent stopped by user — system off until resume', level: 'warn' });
  res.json({ ok: true, stoppedByUser: true, running: !!agent?.running });
});

app.post('/api/reset-daily', (_req, res) => {
  clearConnectsExhausted();
  updateTodayStats({ connectsRemaining: null, stoppedReason: null });
  agentStatus = { ...agentStatus, state: 'idle', currentAction: 'Ready', resumeAt: null };
  io.emit('status', agentStatus);
  res.json({ ok: true });
});

function check24hResume() {
  if (getUserStopped()) return;

  const resumeAt = getConnectsExhaustedAt();
  if (!resumeAt || agent?.running) return;

  const remaining = new Date(resumeAt).getTime() - Date.now();
  if (remaining <= 0) {
    clearConnectsExhausted();
    updateTodayStats({ stoppedReason: null, connectsRemaining: null });
    logActivity({ message: '24 hours passed — connects refreshed, auto-starting agent' });
    io.emit('log', {
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'Auto-resuming after 24h connect refresh',
    });
    agentStatus.resumeAt = null;
    startAgent('24h-auto');
  }
}

setInterval(check24hResume, 60_000);

cron.schedule('0 8 * * *', () => {
  if (getUserStopped()) {
    logActivity({ message: '8 AM PHT — skipped daily auto-start (user stopped agent)' });
    return;
  }
  clearConnectsExhausted();
  updateTodayStats({ stoppedReason: null, connectsRemaining: null });
  logActivity({ message: '8 AM PHT — daily auto-start' });
  startAgent('daily-cron');
}, { timezone: 'Asia/Manila' });

io.on('connection', (socket) => {
  const today = getTodayStats();
  socket.emit('status', {
    ...agentStatus,
    jobsAppliedToday: today.jobs_applied,
    resumeAt: getConnectsExhaustedAt(),
    totalApplied: getAppliedCount(),
    stoppedByUser: getUserStopped(),
    canStart: !agent?.running,
  });
  socket.emit('logs', getRecentLogs(150));
  socket.emit('applied', getAppliedJobs(200));
  socket.emit('analytics', getAnalytics());
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  JobFlow Agent — OnlineJobs.ph`);
  console.log(`  http://0.0.0.0:${PORT}\n`);
  logActivity({ message: getUserStopped() ? 'Server started — agent stopped by user, waiting for resume' : 'Server started' });
  if (!getUserStopped()) {
    check24hResume();
  }
});
