const RESUME_LINK =
  'https://drive.google.com/file/d/1mURxt_cWG0dgU2Mjhe_iVYQSmFle6CAz/view?usp=sharing';

const PROFILE = {
  title: 'Full-Stack Developer & System Architect',
  stack: [
    'Python',
    'Django',
    'FastAPI',
    'Flask',
    'Node.js',
    'Express',
    'NestJS',
    'React',
    'Next.js',
    'Angular',
    'Vue.js',
    'TypeScript',
    'JavaScript',
    'Tailwind CSS',
    'PostgreSQL',
    'MongoDB',
    'Redis',
    'GraphQL',
    'REST APIs',
    'AWS',
    'GCP',
    'Azure',
    'Docker',
    'Kubernetes',
    'CI/CD',
    'Vercel',
    'Supabase',
    'GitHub',
  ],
  strengths: [
    'I design clean, maintainable system architecture that scales as your product grows.',
    'I have built production apps with strong software scalability, performance tuning, and growth-ready backends.',
    'I work comfortably with parallel processing, async jobs, background workers, and high-concurrency API flows.',
    'I have hands-on cloud experience across AWS, GCP, Azure, Vercel, Docker, and containerized deployments.',
    'I follow solid API security practices including auth, rate limiting, validation, and secure endpoint design.',
  ],
  wins: [
    'I have shipped production Python and Node.js backends alongside React, Next.js, and Angular frontends.',
    'I use Claude Code daily with an active Claude Pro subscription for faster, high-quality delivery.',
    'Every change ships with a Vercel preview link so you can review before anything goes live.',
    'I am strong at joining existing codebases, understanding architecture quickly, and shipping without breaking things.',
  ],
};

const SKILL_MAP = {
  python: { label: 'Python', win: 'I build scalable Python backends with Django, FastAPI, and Flask in production.' },
  django: { label: 'Django', win: 'I have delivered Django APIs and admin systems paired with modern frontends.' },
  fastapi: { label: 'FastAPI', win: 'I build fast, typed Python APIs with FastAPI for scalable services.' },
  flask: { label: 'Flask', win: 'I use Flask for lightweight Python services and API layers.' },
  node: { label: 'Node.js', win: 'I build scalable Node.js backends with Express and NestJS.' },
  express: { label: 'Express', win: 'I develop production Express APIs with clean architecture and security.' },
  nest: { label: 'NestJS', win: 'I structure backend services with NestJS for maintainable TypeScript APIs.' },
  react: { label: 'React', win: 'I ship production React apps with polished UI, hooks, and state management.' },
  'next.js': { label: 'Next.js', win: 'I work with Next.js App Router, SSR, API routes, and cloud deployments.' },
  nextjs: { label: 'Next.js', win: 'I work with Next.js App Router, SSR, API routes, and cloud deployments.' },
  angular: { label: 'Angular', win: 'I build structured Angular applications with reusable components and services.' },
  vue: { label: 'Vue.js', win: 'I develop responsive Vue.js frontends with clean component architecture.' },
  typescript: { label: 'TypeScript', win: 'I write fully typed codebases for safer refactors and fewer production bugs.' },
  javascript: { label: 'JavaScript', win: 'I use modern JavaScript across frontend and backend layers.' },
  'full-stack': { label: 'Full-Stack', win: 'I handle end-to-end delivery from system design through deployment.' },
  'full stack': { label: 'Full-Stack', win: 'I handle end-to-end delivery from system design through deployment.' },
  frontend: { label: 'Frontend', win: 'I build pixel-accurate UIs with React, Angular, and Tailwind CSS.' },
  backend: { label: 'Backend', win: 'I design scalable Python and Node.js backends with secure APIs.' },
  ai: { label: 'AI Development', win: 'I build AI-powered SaaS features and agent workflows in production.' },
  saas: { label: 'SaaS', win: 'I have built scalable subscription platforms, dashboards, and user workflows.' },
  tailwind: { label: 'Tailwind CSS', win: 'I deliver rapid, consistent styling across business applications.' },
  supabase: { label: 'Supabase', win: 'I use Supabase for auth, database, and real-time features in production.' },
  vercel: { label: 'Vercel', win: 'I deploy and preview frontend apps on Vercel for every change.' },
  docker: { label: 'Docker', win: 'I use Docker for reproducible deployments and containerized environments.' },
  kubernetes: { label: 'Kubernetes', win: 'I work with container orchestration for scalable cloud deployments.' },
  api: { label: 'APIs', win: 'I design REST and GraphQL APIs with security best practices.' },
  graphql: { label: 'GraphQL', win: 'I implement structured GraphQL APIs for modern applications.' },
  postgresql: { label: 'PostgreSQL', win: 'I design and optimize PostgreSQL databases for production workloads.' },
  mongodb: { label: 'MongoDB', win: 'I build document-based data layers with MongoDB where it fits best.' },
  redis: { label: 'Redis', win: 'I use Redis for caching, queues, and performance optimization.' },
  git: { label: 'Git/GitHub', win: 'I follow clean Git workflows with branches, PRs, and collaborative development.' },
  aws: { label: 'AWS', win: 'I deploy and manage cloud infrastructure on AWS.' },
  gcp: { label: 'GCP', win: 'I have experience deploying services on Google Cloud Platform.' },
  azure: { label: 'Azure', win: 'I work with Azure cloud services for backend and deployment needs.' },
  cloud: { label: 'Cloud', win: 'I build cloud-native systems across AWS, GCP, Azure, and Vercel.' },
  security: { label: 'Security', win: 'I implement API security with auth flows, validation, and secure data handling.' },
  scalable: { label: 'Scalability', win: 'I design systems that handle growth without costly rewrites.' },
  microservice: { label: 'Microservices', win: 'I structure modular services with clear API boundaries.' },
  architect: { label: 'Architecture', win: 'I approach projects with a system architect mindset for long-term maintainability.' },
  claude: { label: 'Claude Code', win: 'I use Claude Code daily as part of my development workflow.' },
  llm: { label: 'LLM Integration', win: 'I integrate LLM-powered features into live SaaS products.' },
  agent: { label: 'Agentic Systems', win: 'I build AI agent workflows and automation pipelines.' },
  crm: { label: 'CRM', win: 'I have built and maintained CRM platforms with clean UX.' },
  automation: { label: 'Automation', win: 'I automate workflows and background processing pipelines.' },
};

const THEME_PATTERNS = [
  { pattern: /part[- ]?time/i, line: 'I am available part-time with a reliable and consistent schedule.' },
  { pattern: /full[- ]?time/i, line: 'I can commit full-time with daily progress updates and preview links.' },
  { pattern: /remote/i, line: 'I work fully remote with strong async communication and self-directed delivery.' },
  { pattern: /us\s+hours?|est|pst|eastern|pacific/i, line: 'I am available during US business hours and flexible to your timezone.' },
  { pattern: /existing\s+(codebase|repo|repository)/i, line: 'I excel at joining live repos, reviewing architecture first, and shipping safely.' },
  { pattern: /bug\s*fix|maintenance|refactor/i, line: 'I test bug fixes through preview deployments so there are no surprise releases.' },
  { pattern: /ai|artificial intelligence|llm|machine learning|agentic/i, line: 'I have hands-on AI development experience and have shipped AI features in production.' },
  { pattern: /lead|senior|architect/i, line: 'I bring a system architect mindset with end-to-end ownership and clear communication.' },
  { pattern: /startup|fast[- ]?paced/i, line: 'I am used to fast-paced teams and shipping working software quickly.' },
  { pattern: /saas|subscription|platform/i, line: 'I have built scalable SaaS platforms from UI through backend and deployment.' },
  { pattern: /security|secure|auth/i, line: 'I have solid API security experience across auth, validation, and secure endpoints.' },
  { pattern: /scale|scalab|high.?traffic|performance/i, line: 'I focus on scalability, performance, and architecture that supports growth.' },
];

function normalize(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function extractRequirements(text, max = 3) {
  return normalize(text)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim().replace(/^[-•*\d.]+\s*/, ''))
    .filter((s) => s.length > 20 && s.length < 220)
    .map((s) => {
      let score = 0;
      if (/must|required|responsibilit|looking for|need|experience|skill|qualif/i.test(s)) score += 3;
      if (/develop|build|implement|react|next|typescript|python|node|api|ai|scale|cloud|security|angular/i.test(s)) score += 2;
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
  if (t.includes('angular')) return 'Full-Stack Engineer (Angular)';
  if (t.includes('react') || t.includes('frontend')) return 'Full-Stack React Developer';
  if (t.includes('python')) return 'Python Engineer / System Architect';
  if (t.includes('full') && t.includes('stack')) return 'Full-Stack System Architect';
  if (t.includes('software')) return 'Software Engineer / System Architect';
  return 'Full-Stack System Architect';
}

function buildSubject(jobTitle, skills) {
  const focus = pickFocus(skills, jobTitle);
  const clean = normalize(jobTitle);
  const variants = [
    `${focus} — US Timezone Available | ${clean}`,
    `Strong Match: ${clean} | ${focus} + Scalable Systems`,
    `Application: ${clean} — ${focus} (Available Immediately)`,
  ];
  return variants[clean.length % variants.length];
}

function paragraph(lines) {
  return lines.filter(Boolean).join(' ');
}

function buildBody({ jobTitle, companyName, skills, themes, requirements }) {
  const company = companyName ? ` at ${companyName}` : '';
  const skillNames = skills.length
    ? skills.slice(0, 5).map((s) => s.label).join(', ')
    : 'Python, Node.js, React, Next.js, and Angular';

  const parts = [
    'Hi,',
    '',
    paragraph([
      `I am excited to apply for the ${jobTitle} role${company}.`,
      `I am a ${PROFILE.title} with hands-on experience in scalable software, cloud deployments, parallel processing, and API security.`,
      `Your need for ${skillNames} aligns closely with my background.`,
    ]),
    '',
    `Why I am a strong fit for ${jobTitle}`,
    '',
  ];

  const fitLines = skills.length
    ? skills.slice(0, 4).map((s) => s.win)
    : [
        'I build production apps with Python and Node.js backends plus React, Next.js, and Angular frontends.',
        'I deliver clean TypeScript and JavaScript code with responsive UI and reliable API integrations.',
        'I deploy through cloud platforms with preview links for every change before release.',
      ];
  for (const line of fitLines) {
    parts.push(line);
    parts.push('');
  }

  parts.push('System architecture and engineering strengths');
  parts.push('');
  for (const line of PROFILE.strengths) {
    parts.push(line);
    parts.push('');
  }

  if (requirements.length > 0 || themes.length > 0) {
    parts.push('How I match your requirements');
    parts.push('');
    for (const req of requirements.slice(0, 2)) {
      const short = req.length > 110 ? `${req.slice(0, 107)}...` : req;
      parts.push(`You mentioned: "${short}" — I have direct hands-on experience delivering this type of work.`);
      parts.push('');
    }
    for (const theme of themes.slice(0, 2)) {
      parts.push(theme.line);
      parts.push('');
    }
  }

  parts.push('What sets me apart');
  parts.push('');
  for (const win of PROFILE.wins) {
    parts.push(win);
    parts.push('');
  }

  parts.push('Tech stack');
  parts.push('');
  parts.push(PROFILE.stack.join(', '));
  parts.push('');
  parts.push('Availability and timezone');
  parts.push('');
  parts.push('I am available in US time zones (EST / PST / flexible) and can adjust my schedule to match your team across Philippines, US, EU, or APAC.');
  parts.push('');
  parts.push('I provide daily progress updates with preview links and can start immediately.');
  parts.push('');
  parts.push(`Resume: ${RESUME_LINK}`);
  parts.push('');
  parts.push(
    `I would welcome the chance to discuss how my system architecture and engineering experience can help your team. Looking forward to your reply.`,
  );

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
