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
} from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3847;

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

app.use(express.json());
app.use(express.static(join(__dirname, '..', 'public')));

let agent = null;
let agentStatus = {
  state: 'idle',
  currentAction: 'Ready',
  currentJob: null,
  currentSearch: null,
  connectsRemaining: null,
  jobsAppliedToday: 0,
  totalApplied: getAppliedCount(),
  resumeAt: getConnectsExhaustedAt(),
  lastError: null,
};

function startAgent(source = 'manual') {
  if (agent?.running) return false;

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
      };
    },
  });

  agent.start().then(() => {
    agentStatus.totalApplied = getAppliedCount();
    io.emit('status', agentStatus);
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
    searchKeywords: (process.env.JOB_KEYWORDS || 'React,Software Engineer,AI Engineer,Backend Developer').split(','),
  });
});

app.get('/api/logs', (_req, res) => res.json(getRecentLogs(150)));
app.get('/api/applied', (_req, res) => res.json(getAppliedJobs(200)));
app.get('/api/analytics', (_req, res) => res.json(getAnalytics()));

app.post('/api/start', (_req, res) => {
  if (agent?.running) return res.status(409).json({ error: 'Agent is already running' });
  clearConnectsExhausted();
  agentStatus.resumeAt = null;
  startAgent('manual');
  res.json({ ok: true });
});

app.post('/api/stop', (_req, res) => {
  agent?.stop();
  logActivity({ message: 'Agent stopped by user', level: 'warn' });
  res.json({ ok: true });
});

app.post('/api/reset-daily', (_req, res) => {
  clearConnectsExhausted();
  updateTodayStats({ connectsRemaining: null, stoppedReason: null });
  agentStatus = { ...agentStatus, state: 'idle', currentAction: 'Ready', resumeAt: null };
  io.emit('status', agentStatus);
  res.json({ ok: true });
});

function check24hResume() {
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
  });
  socket.emit('logs', getRecentLogs(150));
  socket.emit('applied', getAppliedJobs(200));
  socket.emit('analytics', getAnalytics());
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  JobFlow Agent — OnlineJobs.ph`);
  console.log(`  http://0.0.0.0:${PORT}\n`);
  logActivity({ message: 'Server started' });
  check24hResume();
});
