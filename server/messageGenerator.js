const RESUME_LINK =
  'https://drive.google.com/file/d/1mURxt_cWG0dgU2Mjhe_iVYQSmFle6CAz/view?usp=sharing';

// **word** = emphasis in plain-text emails
const B = (text) => `**${text}**`;

const PROFILE = {
  title: 'Full-Stack Developer & System Architect',
  stack: ['Next.js', 'React', 'TypeScript', 'Tailwind CSS', 'GitHub', 'Vercel', 'Supabase', 'Resend', 'AWS'],
  architecture: [
    `${B('System architecture')} — design clean, maintainable systems that scale with your product`,
    `${B('Software scalability')} — built apps handling growth without rewrites; performance-first from day one`,
    `${B('Parallel processing')} — async jobs, background workers, and concurrent API flows in production`,
    `${B('Cloud experience')} — Vercel, AWS, serverless deployments, and containerized environments`,
    `${B('API security')} — auth, rate limiting, input validation, and secure endpoint design`,
  ],
  wins: [
    `Shipped multiple ${B('production')} Next.js/React apps — AI SaaS platforms, CRM systems, and business websites`,
    `Active ${B('Claude Pro')} user — Claude Code is my daily driver for faster, higher-quality delivery`,
    `Every change ships with a ${B('Vercel preview link')} — you review before anything goes live`,
    `Strong at joining ${B('existing codebases')} — understand architecture fast, ship without breaking things`,
  ],
};

const SKILL_MAP = {
  react: { label: 'React', win: `${B('Production')} React apps — hooks, state management, and polished UI at scale` },
  'next.js': { label: 'Next.js', win: `App Router, SSR, API routes, and ${B('cloud')} deployments on Vercel` },
  nextjs: { label: 'Next.js', win: `App Router, SSR, API routes, and ${B('cloud')} deployments on Vercel` },
  typescript: { label: 'TypeScript', win: `${B('Fully typed')} codebases — fewer bugs, safer refactors` },
  javascript: { label: 'JavaScript', win: `Modern ES6+ across frontend and ${B('API')} layers` },
  node: { label: 'Node.js', win: `Server actions, API routes, and ${B('scalable')} backend integrations` },
  python: { label: 'Python', win: `Automation, backend tooling, and ${B('parallel processing')} scripts` },
  django: { label: 'Django', win: `Python backends paired with React frontends` },
  'full-stack': { label: 'Full-Stack', win: `${B('End-to-end')} delivery — system design through deployment` },
  'full stack': { label: 'Full-Stack', win: `${B('End-to-end')} delivery — system design through deployment` },
  frontend: { label: 'Frontend', win: `Pixel-accurate UI with Tailwind CSS and modern React` },
  backend: { label: 'Backend', win: `${B('API')} integrations, Supabase, and server-side logic at scale` },
  ai: { label: 'AI Development', win: `${B('AI-powered')} SaaS features built with Claude Code` },
  saas: { label: 'SaaS', win: `${B('Scalable')} subscription platforms, dashboards, and user workflows` },
  tailwind: { label: 'Tailwind CSS', win: `Rapid, consistent styling across business sites` },
  supabase: { label: 'Supabase', win: `Auth, database, and real-time in production` },
  vercel: { label: 'Vercel', win: `${B('Cloud')} preview deployments for every change` },
  docker: { label: 'Docker', win: `Containerized environments for ${B('reproducible')} deployments` },
  api: { label: 'APIs', win: `${B('REST API')} design, ${B('security')} best practices, and clean integrations` },
  graphql: { label: 'GraphQL', win: `Structured data fetching in modern apps` },
  postgresql: { label: 'PostgreSQL', win: `Database design and optimization through Supabase` },
  git: { label: 'Git/GitHub', win: `Branch workflows, PRs, and collaborative dev` },
  aws: { label: 'AWS', win: `${B('Cloud')} infrastructure and deployment experience` },
  cloud: { label: 'Cloud', win: `${B('Cloud-native')} architecture on Vercel and AWS` },
  security: { label: 'Security', win: `${B('API security')} — auth, validation, and secure data handling` },
  scalable: { label: 'Scalability', win: `${B('Scalable')} system design for growing user bases` },
  microservice: { label: 'Microservices', win: `Modular service architecture and API boundaries` },
  architect: { label: 'Architecture', win: `${B('System architecture')} for maintainable, scalable codebases` },
  claude: { label: 'Claude Code', win: `Daily ${B('AI-assisted')} development workflow` },
  llm: { label: 'LLM Integration', win: `Claude-powered features in live SaaS products` },
  agent: { label: 'Agentic Systems', win: `AI agent workflows and ${B('parallel')} automation pipelines` },
  crm: { label: 'CRM', win: `Built and maintained CRM platforms with clean UX` },
  automation: { label: 'Automation', win: `Workflow automation and ${B('parallel processing')} pipelines` },
};

const THEME_PATTERNS = [
  { pattern: /part[- ]?time/i, bullet: `${B('Part-time')} available — reliable and consistent schedule` },
  { pattern: /full[- ]?time/i, bullet: `${B('Full-time')} commitment with daily progress updates and preview links` },
  { pattern: /remote/i, bullet: `${B('Fully remote')} — strong async communication and self-directed delivery` },
  { pattern: /us\s+hours?|est|pst|eastern|pacific/i, bullet: `Available during ${B('US business hours')} and flexible to your timezone` },
  { pattern: /existing\s+(codebase|repo|repository)/i, bullet: `Excel at joining live repos — ${B('system architecture')} review first, then ship safely` },
  { pattern: /bug\s*fix|maintenance|refactor/i, bullet: `Bug fixes tested via Vercel preview — ${B('zero-surprise')} deployments` },
  { pattern: /ai|artificial intelligence|llm|machine learning|agentic/i, bullet: `${B('Hands-on AI')} development with Claude Code — shipped in production` },
  { pattern: /lead|senior|architect/i, bullet: `${B('System architect')} mindset — end-to-end ownership with clear communication` },
  { pattern: /startup|fast[- ]?paced/i, bullet: `Built for ${B('fast-paced')} teams — ship working software quickly` },
  { pattern: /saas|subscription|platform/i, bullet: `Built ${B('scalable')} AI-powered SaaS platforms from UI to production` },
  { pattern: /security|secure|auth/i, bullet: `${B('API security')} experience — auth flows, validation, and secure endpoints` },
  { pattern: /scale|scalab|high.?traffic|performance/i, bullet: `${B('Scalability')} focus — performance and growth-ready architecture` },
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
      if (/develop|build|implement|react|next|typescript|api|ai|scale|cloud|security/i.test(s)) score += 2;
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
  if (t.includes('architect')) return 'System Architect';
  if (t.includes('senior') || t.includes('lead')) return 'Senior Engineer / System Architect';
  if (t.includes('ai') || skills.some((s) => /ai|claude|llm/i.test(s.label))) return 'AI Engineer';
  if (t.includes('backend')) return 'Backend Engineer / System Architect';
  if (t.includes('react') || t.includes('frontend')) return 'React Developer';
  if (t.includes('full') && t.includes('stack')) return 'Full-Stack System Architect';
  if (t.includes('software')) return 'Software Engineer / System Architect';
  return 'Full-Stack System Architect';
}

function buildSubject(jobTitle, skills) {
  const focus = pickFocus(skills, jobTitle);
  const clean = normalize(jobTitle);
  const variants = [
    `${focus} — ${B('US Timezone')} Available | ${clean}`,
    `Strong Match: ${clean} | ${focus} + ${B('Scalable')} Systems`,
    `Application: ${clean} — ${focus} (${B('Available Immediately')})`,
  ];
  return variants[clean.length % variants.length].replace(/\*\*/g, ''); // subjects: no markdown
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
    `I'm excited to apply for the ${jobTitle} role${company}. I'm a ${B('Full-Stack Developer & System Architect')} with hands-on experience in ${B('scalable software')}, ${B('cloud deployments')}, ${B('parallel processing')}, and ${B('API security')}. Your need for ${skillNames} aligns directly with my background.`,
  ];

  parts.push(sectionHeading(`Why I'm the right fit for ${jobTitle}`));
  for (const skill of skills.slice(0, 4)) {
    parts.push(`• ${skill.win}`);
  }
  if (skills.length === 0) {
    parts.push(`• ${B('React & Next.js')}: Production apps with component-level UI and feature delivery`);
    parts.push(`• ${B('TypeScript & Tailwind')}: Clean, typed, responsive interfaces`);
    parts.push(`• ${B('Cloud deployment')}: Vercel preview link for every change before it goes live`);
  }

  parts.push(sectionHeading('System Architecture & Engineering Strengths'));
  for (const line of PROFILE.architecture) {
    parts.push(`• ${line}`);
  }

  if (requirements.length > 0 || themes.length > 0) {
    parts.push(sectionHeading('How I match your requirements'));
    for (const req of requirements.slice(0, 2)) {
      const short = req.length > 100 ? `${req.slice(0, 97)}...` : req;
      parts.push(`• "${short}" → ${B('Direct hands-on experience')} delivering exactly this`);
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

  parts.push(sectionHeading('Availability & Timezone'));
  parts.push(`• ${B('Available in US time zones')} (EST / PST / flexible)`);
  parts.push(`• Can ${B('adjust my schedule')} to match your team's timezone — Philippines, US, EU, or APAC`);
  parts.push(`• ${B('Daily progress updates')} with Vercel preview links`);
  parts.push(`• ${B('Can start immediately')}`);
  parts.push(``);
  parts.push(`Resume: ${RESUME_LINK}`);
  parts.push(``);
  parts.push(`I'd welcome the chance to discuss how my ${B('system architecture')} and engineering experience can help your team. Looking forward to your reply.`);

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
