const RESUME_LINK =
  'https://drive.google.com/file/d/1mURxt_cWG0dgU2Mjhe_iVYQSmFle6CAz/view?usp=sharing';

const PROFILE = {
  stack: ['Next.js', 'React', 'TypeScript', 'Tailwind CSS', 'GitHub', 'Vercel', 'Supabase', 'Resend'],
  wins: [
    'Shipped multiple production Next.js/React apps — from AI SaaS platforms to CRM systems',
    'Active Claude Pro user — Claude Code is part of my daily workflow for faster, higher-quality delivery',
    'Every change gets a Vercel preview link — you review before anything goes live',
    'Strong at joining existing codebases and delivering without breaking current architecture',
  ],
};

const SKILL_MAP = {
  react: { label: 'React', win: 'Production React apps with hooks, state management, and polished UI components' },
  'next.js': { label: 'Next.js', win: 'App Router, SSR, API routes, and live Vercel deployments' },
  nextjs: { label: 'Next.js', win: 'App Router, SSR, API routes, and live Vercel deployments' },
  typescript: { label: 'TypeScript', win: 'Fully typed codebases — fewer bugs, safer refactors' },
  javascript: { label: 'JavaScript', win: 'Modern ES6+ across frontend and API layers' },
  node: { label: 'Node.js', win: 'Server actions, API routes, and backend integrations' },
  python: { label: 'Python', win: 'Automation scripts and backend tooling' },
  django: { label: 'Django', win: 'Python backends paired with React frontends' },
  'full-stack': { label: 'Full-Stack', win: 'End-to-end feature delivery from UI to deployment' },
  'full stack': { label: 'Full-Stack', win: 'End-to-end feature delivery from UI to deployment' },
  frontend: { label: 'Frontend', win: 'Pixel-accurate UI with Tailwind CSS and modern React' },
  backend: { label: 'Backend', win: 'API integrations, Supabase, and server-side logic' },
  ai: { label: 'AI Development', win: 'AI-powered SaaS features built with Claude Code' },
  saas: { label: 'SaaS', win: 'Subscription platforms, dashboards, and user workflows' },
  tailwind: { label: 'Tailwind CSS', win: 'Rapid, consistent styling across business sites' },
  supabase: { label: 'Supabase', win: 'Auth, database, and real-time in production' },
  vercel: { label: 'Vercel', win: 'Preview deployments for every single change' },
  docker: { label: 'Docker', win: 'Containerized development environments' },
  api: { label: 'APIs', win: 'REST integrations and clean endpoint design' },
  graphql: { label: 'GraphQL', win: 'Structured data fetching in modern apps' },
  postgresql: { label: 'PostgreSQL', win: 'Database work through Supabase' },
  git: { label: 'Git/GitHub', win: 'Branch workflows, PRs, and collaborative dev' },
  'react native': { label: 'React Native', win: 'Cross-platform mobile with React' },
  claude: { label: 'Claude Code', win: 'Daily AI-assisted development — faster delivery' },
  llm: { label: 'LLM Integration', win: 'Claude-powered features in live SaaS products' },
  agent: { label: 'Agentic Systems', win: 'AI agent workflows and automation pipelines' },
  crm: { label: 'CRM', win: 'Built and maintained CRM platforms with clean UX' },
  automation: { label: 'Automation', win: 'Workflow automation and AI-assisted tooling' },
};

const THEME_PATTERNS = [
  { pattern: /part[- ]?time/i, bullet: 'Available part-time during Philippines/Beijing hours — reliable and consistent' },
  { pattern: /full[- ]?time/i, bullet: 'Full-time commitment with daily progress updates and preview links' },
  { pattern: /remote/i, bullet: 'Fully remote with strong async communication and self-directed delivery' },
  { pattern: /existing\s+(codebase|repo|repository)/i, bullet: 'I excel at joining live repos — understand architecture fast, ship without breaking things' },
  { pattern: /bug\s*fix|maintenance|refactor/i, bullet: 'Bug fixes tested via Vercel preview before every push — zero-surprise deployments' },
  { pattern: /ai|artificial intelligence|llm|machine learning|agentic/i, bullet: 'Hands-on AI feature development with Claude Code — not just theory, shipped in production' },
  { pattern: /lead|senior/i, bullet: 'End-to-end ownership with proactive communication — you always know where things stand' },
  { pattern: /startup|fast[- ]?paced/i, bullet: 'Built for fast-paced teams — I ship working software, not slide decks' },
  { pattern: /saas|subscription|platform/i, bullet: 'Built AI-powered SaaS platforms from UI to production deployment' },
];

function normalize(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function extractRequirements(text, max = 4) {
  return normalize(text)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim().replace(/^[-•*\d.]+\s*/, ''))
    .filter((s) => s.length > 20 && s.length < 220)
    .map((s) => {
      let score = 0;
      if (/must|required|responsibilit|looking for|need|experience|skill|qualif/i.test(s)) score += 3;
      if (/develop|build|implement|react|next|typescript|api|ai/i.test(s)) score += 2;
      if (/benefit|we offer|salary/i.test(s)) score -= 3;
      return { s, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((x) => x.s);
}

function matchSkills(jobTitle, jobDescription) {
  const text = `${jobTitle} ${jobDescription}`.toLowerCase();
  const found = [];
  const seen = new Set();
  for (const [keyword, info] of Object.entries(SKILL_MAP)) {
    if (text.includes(keyword) && !seen.has(info.label)) {
      seen.add(info.label);
      found.push(info);
    }
  }
  return found;
}

function detectThemes(text) {
  return THEME_PATTERNS.filter((t) => t.pattern.test(text));
}

function pickFocus(skills, jobTitle) {
  const t = jobTitle.toLowerCase();
  if (t.includes('ai') || skills.some((s) => /ai|claude|llm/i.test(s.label))) return 'AI Engineer';
  if (t.includes('backend')) return 'Backend Developer';
  if (t.includes('react') || t.includes('frontend')) return 'React Developer';
  if (t.includes('full') && t.includes('stack')) return 'Full-Stack Developer';
  if (t.includes('software')) return 'Software Engineer';
  return skills[0]?.label || 'React / Next.js Developer';
}

function buildSubject(jobTitle, skills) {
  const focus = pickFocus(skills, jobTitle);
  const clean = normalize(jobTitle);
  const variants = [
    `${focus} — Ready to Start | ${clean}`,
    `Strong Match for ${clean} | ${focus}`,
    `Application: ${clean} — ${focus} (Available Immediately)`,
  ];
  return variants[clean.length % variants.length];
}

function sectionHeading(title) {
  return `\n── ${title.toUpperCase()} ──`;
}

function buildBody({ jobTitle, companyName, skills, themes, requirements }) {
  const company = companyName ? ` at ${companyName}` : '';
  const skillNames = skills.length
    ? skills.slice(0, 4).map((s) => s.label).join(', ')
    : 'React, Next.js, TypeScript';

  const parts = [
    `Hi,`,
    ``,
    `I'm excited to apply for the ${jobTitle} role${company}. I reviewed your posting carefully — your need for ${skillNames} is exactly what I do every day, and I'd love to bring that experience to your team.`,
  ];

  parts.push(sectionHeading(`Why I'm the right fit for ${jobTitle}`));
  for (const skill of skills.slice(0, 4)) {
    parts.push(`• ${skill.label}: ${skill.win}`);
  }
  if (skills.length === 0) {
    parts.push(`• React & Next.js: Production apps with component-level UI and feature delivery`);
    parts.push(`• TypeScript & Tailwind: Clean, typed, responsive interfaces`);
    parts.push(`• Deployment: Vercel preview link for every change before it goes live`);
  }

  if (requirements.length > 0 || themes.length > 0) {
    parts.push(sectionHeading('How I match your requirements'));
    for (const req of requirements.slice(0, 2)) {
      const short = req.length > 100 ? `${req.slice(0, 97)}...` : req;
      parts.push(`• "${short}" → I have direct, hands-on experience delivering exactly this`);
    }
    for (const theme of themes.slice(0, 2)) {
      parts.push(`• ${theme.bullet}`);
    }
  }

  parts.push(sectionHeading('What sets me apart'));
  for (const win of PROFILE.wins) {
    parts.push(`• ${win}`);
  }

  parts.push(sectionHeading('Tech stack'));
  parts.push(`• ${PROFILE.stack.join(' · ')}`);

  parts.push(sectionHeading('Availability'));
  parts.push(`• Beijing / Philippines business hours`);
  parts.push(`• Daily progress updates with Vercel preview links`);
  parts.push(`• Can start immediately`);
  parts.push(``);
  parts.push(`Resume: ${RESUME_LINK}`);
  parts.push(``);
  parts.push(`I'd welcome the chance to discuss how I can contribute to your team. Looking forward to your reply.`);

  return parts.join('\n');
}

export async function generateTailoredMessage({ jobTitle, jobDescription, companyName }) {
  const title = normalize(jobTitle) || 'Software Engineer';
  const description = normalize(jobDescription);
  const skills = matchSkills(title, description);
  const themes = detectThemes(`${title} ${description}`);
  const requirements = extractRequirements(description, 4);

  return {
    subject: buildSubject(title, skills),
    body: buildBody({ jobTitle: title, companyName: normalize(companyName), skills, themes, requirements }),
    mode: 'local-ai',
    meta: { matchedSkills: skills.map((s) => s.label), themes: themes.length },
  };
}
