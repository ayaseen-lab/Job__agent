# Deploy JobFlow Agent (24/7 Cloud)

## Important: Vercel vs Railway

**Vercel cannot run this agent.** Vercel is serverless (short-lived functions) and cannot:
- Run Playwright/Chromium browser automation
- Keep a process alive 24/7
- Maintain WebSocket connections for the live dashboard

**Use Railway or Render** — they run a persistent Docker container that keeps working even when your laptop is off.

---

## Option 1: Railway (Recommended)

1. Push this repo to GitHub (already done if you followed setup)
2. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub**
3. Select `ayaseen-lab/Job__agent`
4. Add environment variables in Railway dashboard:

| Variable | Value |
|----------|-------|
| `OJ_EMAIL` | your OnlineJobs email |
| `OJ_PASSWORD` | your OnlineJobs password |
| `JOB_KEYWORDS` | `React,Software Engineer,AI Engineer,Backend Developer` |
| `HEADLESS` | `true` |
| `MAX_SEARCH_PAGES` | `3` |

5. Railway auto-detects the `Dockerfile` and deploys
6. Go to **Settings → Networking → Generate Domain**
7. Open your Railway URL — that's your 24/7 dashboard
8. Click **Start Agent** — it runs until you click **Stop**, even with laptop off

### Persist application history
In Railway → your service → **Volumes** → Add volume:
- Mount path: `/app/data`

---

## Option 2: Render

1. Go to [render.com](https://render.com) → **New Blueprint**
2. Connect GitHub repo `ayaseen-lab/Job__agent`
3. Render reads `render.yaml` automatically
4. Add `OJ_EMAIL` and `OJ_PASSWORD` as secret env vars
5. Deploy — get your public URL

---

### Step 4: Connect Vercel dashboard to Railway backend

Edit `public/config.js` in GitHub (or locally) and set:
```javascript
window.JOBFLOW_CONFIG = { API_URL: 'https://YOUR-RAILWAY-URL.up.railway.app' };
```
Push to GitHub — Vercel auto-redeploys. Now https://onlineph.vercel.app controls your 24/7 cloud agent.

---

## Option 3: Vercel (dashboard UI only)

If you want a `vercel.app` domain, edit `public/config.js` with your Railway URL and push. Vercel auto-deploys from GitHub.

Live dashboard: **https://onlineph.vercel.app** (needs Railway backend URL in config.js)

```bash
npx vercel --prod
```

---

## Add GitHub Collaborators

1. Go to https://github.com/ayaseen-lab/Job__agent/settings/access
2. Click **Add people**
3. Enter their GitHub username or email

---

## After Deployment

Your cloud URL (e.g. `https://jobflow-agent.up.railway.app`) is your permanent dashboard. Bookmark it on your phone — start/stop the agent from anywhere.
