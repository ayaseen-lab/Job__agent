# JobFlow Agent

Automated job application agent for [OnlineJobs.ph](https://www.onlinejobs.ph) with a realtime web dashboard.

## Features

- Auto-login and apply to jobs across multiple search keywords
- Prioritizes same-day posted jobs first
- Tailored application messages with bullet points and section headings
- Stops when connects hit zero, auto-resumes after 24 hours
- Full application history with subject, message, and job description
- Live dashboard with charts and activity feed

## Local Development

```bash
npm install
npm run install-browser
cp .env.example .env   # add your credentials
npm start
```

Open http://localhost:3847

## Cloud Deployment (24/7 — laptop can be off)

**Vercel cannot run this agent** (needs persistent browser automation). Deploy on **Railway** or **Render** instead.

See **[DEPLOY.md](./DEPLOY.md)** for full step-by-step instructions.

Quick Railway setup:
1. Connect GitHub repo at [railway.app](https://railway.app)
2. Add `OJ_EMAIL` and `OJ_PASSWORD` env vars
3. Generate a public domain
4. Open URL → Start Agent

## Search Keywords

Configured via `JOB_KEYWORDS` in `.env`:
```
React,Software Engineer,AI Engineer,Backend Developer
```

## Repository

https://github.com/ayaseen-lab/Job__agent
