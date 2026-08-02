const API_BASE = window.JOBFLOW_CONFIG?.API_URL || '';
const socket = io(API_BASE || undefined, { transports: ['websocket', 'polling'] });
const $ = (id) => document.getElementById(id);

let dailyChart = null;
let keywordChart = null;
let resumeAt = null;
let lastStatus = {};
let totalAppliedCount = 0;

const STATE_LABELS = {
  idle: 'Idle', starting: 'Starting', logging_in: 'Logging In',
  searching: 'Searching Jobs', applying: 'Applying', stopping: 'Stopping',
  stopped_no_connects: 'No Connects', error: 'Error',
};


function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

function formatTime(iso) {
  return new Date(iso).toLocaleString();
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function updateUI(status) {
  lastStatus = status;
  if (status.totalApplied != null) totalAppliedCount = status.totalApplied;
  const state = status.state || 'idle';
  $('statusLabel').textContent = STATE_LABELS[state] || state;

  const dot = $('statusDot');
  dot.className = 'status-dot';
  if (['starting', 'logging_in', 'searching', 'applying'].includes(state)) dot.classList.add('running');
  else if (state === 'stopped_no_connects') dot.classList.add('warning');
  else if (state === 'error') dot.classList.add('error');

  $('connectsValue').textContent = status.connectsRemaining ?? '—';
  $('connectsValue').style.color = status.connectsRemaining === 0 ? 'var(--orange)' : '';
  $('appliedToday').textContent = status.jobsAppliedToday ?? 0;
  $('totalApplied').textContent = status.totalApplied ?? 0;
  $('currentAction').textContent = status.currentAction || 'Ready';

  if (status.currentJob?.title) {
    $('currentJobCard').hidden = false;
    $('currentJobLink').textContent = status.currentJob.title;
    $('currentJobLink').href = status.currentJob.url || '#';
    $('currentSearch').textContent = status.currentSearch ? `Search: ${status.currentSearch}` : '';
  } else {
    $('currentJobCard').hidden = true;
  }

  const isRunning = ['starting', 'logging_in', 'searching', 'applying', 'stopping'].includes(state);
  $('btnStart').disabled = isRunning;
  $('btnStop').disabled = !isRunning;

  resumeAt = status.resumeAt;
  if (resumeAt && state === 'stopped_no_connects') {
    $('resumeTimer').hidden = false;
  } else {
    $('resumeTimer').hidden = true;
  }

  if (status.searchKeywords) {
    $('searchTags').innerHTML = status.searchKeywords.map((k) => `<span class="tag">${escapeHtml(k.trim())}</span>`).join('');
  }
}

function updateTimer() {
  if (!resumeAt) return;
  const remaining = new Date(resumeAt).getTime() - Date.now();
  if (remaining <= 0) {
    $('timerValue').textContent = 'Resuming...';
    return;
  }
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  $('timerValue').textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
setInterval(updateTimer, 1000);

function addLog(entry, prepend = true) {
  const feed = $('logFeed');
  const empty = feed.querySelector('.empty');
  if (empty) empty.remove();

  const div = document.createElement('div');
  div.className = `log-entry ${entry.level === 'warn' ? 'warn' : entry.level === 'error' ? 'error' : 'info'}`;
  div.innerHTML = `<span class="log-time">${formatTime(entry.timestamp)}</span>${escapeHtml(entry.message)}`;
  prepend ? feed.insertBefore(div, feed.firstChild) : feed.appendChild(div);
  while (feed.children.length > 200) feed.removeChild(feed.lastChild);
}

function titleFromSlug(slug) {
  return (slug || '')
    .replace(/-\d+$/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function displayJobTitle(job) {
  const title = (job.job_title || '').trim().replace(/\s+/g, ' ');
  const slugTitle = titleFromSlug(job.job_id);
  if (!title || title.length > 80) return slugTitle;
  if (/\b(we are|we're|looking for|seeking|requirements|qualifications|experience in)\b/i.test(title)) {
    return slugTitle;
  }
  const cleaned = title.split(/\s{2,}|•|—|\||\n/)[0].trim();
  return cleaned && cleaned.length <= 80 ? cleaned : slugTitle;
}

function renderHistory(jobs) {
  if (!Array.isArray(jobs)) return;

  const total = totalAppliedCount || jobs.length;
  $('historyCount').textContent =
    total > jobs.length
      ? `${jobs.length} of ${total} applications`
      : `${total} application${total !== 1 ? 's' : ''}`;
  const list = $('historyList');

  if (!jobs.length) {
    list.innerHTML = '<div class="empty">No applications yet — start the agent to begin</div>';
    return;
  }

  list.innerHTML = jobs.map((j, i) => {
    const title = displayJobTitle(j);
    return `
    <div class="history-card" data-idx="${i}">
      <div class="history-header" onclick="toggleHistory(${i})">
        <div class="hc-left">
          <div class="hc-title"><a href="${escapeHtml(j.job_url)}" target="_blank" onclick="event.stopPropagation()">${escapeHtml(title)}</a></div>
          <div class="hc-meta">
            <span>${formatDate(j.applied_at)}</span>
            ${j.company_name ? `<span>${escapeHtml(j.company_name)}</span>` : ''}
            ${j.search_keyword ? `<span class="hc-badge keyword">${escapeHtml(j.search_keyword)}</span>` : ''}
            ${j.posted_label ? `<span class="hc-badge today">${escapeHtml(j.posted_label)}</span>` : ''}
          </div>
        </div>
        <span class="hc-chevron">▾</span>
      </div>
      <div class="history-body">
        <div class="hb-section">
          <div class="hb-label">Subject Line</div>
          <div class="hb-subject">${escapeHtml(j.subject || '—')}</div>
        </div>
        <div class="hb-section">
          <div class="hb-label">Application Message</div>
          <div class="hb-text">${escapeHtml(j.body || '—')}</div>
        </div>
        ${j.description ? `
        <div class="hb-section">
          <div class="hb-label">Job Description (excerpt)</div>
          <div class="hb-text">${escapeHtml(j.description.slice(0, 800))}${j.description.length > 800 ? '...' : ''}</div>
        </div>` : ''}
      </div>
    </div>
  `;
  }).join('');
}

window.toggleHistory = (idx) => {
  const card = document.querySelector(`.history-card[data-idx="${idx}"]`);
  card?.classList.toggle('open');
};

function renderCharts(analytics) {
  $('todayJobsHit').textContent = analytics.recentTodayJobs ?? 0;
  if (analytics.total != null) totalAppliedCount = analytics.total;

  const chartDefaults = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { color: '#243049' }, ticks: { color: '#7b8ba3', font: { size: 10 } } },
      y: { grid: { color: '#243049' }, ticks: { color: '#7b8ba3', font: { size: 10 }, stepSize: 1 }, beginAtZero: true },
    },
  };

  if (dailyChart) dailyChart.destroy();
  dailyChart = new Chart($('chartDaily'), {
    type: 'bar',
    data: {
      labels: analytics.byDay.map((d) => d.date.slice(5)),
      datasets: [{ data: analytics.byDay.map((d) => d.count), backgroundColor: '#4f8cff', borderRadius: 6 }],
    },
    options: chartDefaults,
  });

  if (keywordChart) keywordChart.destroy();
  const colors = ['#4f8cff', '#34d399', '#fb923c', '#a78bfa', '#f472b6'];
  keywordChart = new Chart($('chartKeywords'), {
    type: 'doughnut',
    data: {
      labels: analytics.byKeyword.map((k) => k.name),
      datasets: [{ data: analytics.byKeyword.map((k) => k.count), backgroundColor: colors }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { color: '#7b8ba3', font: { size: 11 } } } },
    },
  });
}

socket.on('status', updateUI);
socket.on('log', (e) => addLog(e, true));
socket.on('logs', (logs) => {
  $('logFeed').innerHTML = '';
  if (!logs.length) $('logFeed').innerHTML = '<div class="empty">Waiting for activity...</div>';
  else logs.forEach((e) => addLog(e, false));
});
socket.on('applied', renderHistory);
socket.on('analytics', renderCharts);
socket.on('application', () => {
  fetch(`${API_BASE}/api/applied`).then((r) => r.json()).then(renderHistory);
  fetch(`${API_BASE}/api/analytics`).then((r) => r.json()).then(renderCharts);
  fetch(`${API_BASE}/api/status`).then((r) => r.json()).then(updateUI);
});

$('btnStart').addEventListener('click', async () => {
  $('btnStart').disabled = true;
  const res = await fetch(`${API_BASE}/api/start`, { method: 'POST' });
  if (!res.ok) {
    const d = await res.json();
    addLog({ timestamp: new Date().toISOString(), level: 'error', message: d.error });
    $('btnStart').disabled = false;
  }
});
$('btnStop').addEventListener('click', async () => {
  $('btnStop').disabled = true;
  updateUI({ ...lastStatus, state: 'stopping', currentAction: 'Stopping...', currentJob: null });
  try {
    const res = await fetch(`${API_BASE}/api/stop`, { method: 'POST' });
    if (!res.ok) throw new Error('Stop request failed');
    const status = await fetch(`${API_BASE}/api/status`).then((r) => r.json());
    updateUI(status);
  } catch {
    addLog({ timestamp: new Date().toISOString(), level: 'error', message: 'Failed to stop agent — try again' });
    $('btnStop').disabled = false;
  }
});
$('btnReset').addEventListener('click', async () => {
  await fetch(`${API_BASE}/api/reset-daily`, { method: 'POST' });
  addLog({ timestamp: new Date().toISOString(), level: 'info', message: 'Daily lock cleared' });
});

Promise.all([
  fetch(`${API_BASE}/api/status`).then((r) => r.json()),
  fetch(`${API_BASE}/api/logs`).then((r) => r.json()),
  fetch(`${API_BASE}/api/applied`).then((r) => r.json()),
  fetch(`${API_BASE}/api/analytics`).then((r) => r.json()),
]).then(([status, logs, applied, analytics]) => {
  updateUI(status);
  if (!logs.length) $('logFeed').innerHTML = '<div class="empty">Waiting for activity...</div>';
  else logs.forEach((e) => addLog(e, false));
  renderHistory(applied);
  renderCharts(analytics);
});
