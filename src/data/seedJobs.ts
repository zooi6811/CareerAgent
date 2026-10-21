import {
  ApplicationRecord,
  CandidateProfile,
  ConsultantChatMessage,
  JobListing,
} from '../types/career';

export const DEFAULT_BASE_RESUME = `JORDAN VANCE
San Francisco, CA (Open to Remote & Hybrid) · jordan.vance@meridiancareer.io · github.com/jordanvance

EXPERIENCE
Senior Full-Stack & AI Systems Engineer | Horizon Cloud Systems (2022 – Present)
• Architected a real-time AI document synthesis pipeline serving 140,000+ daily enterprise users with p95 latency under 450ms using TypeScript, Node.js, Python, and LLM tool orchestration.
• Led migration of monolithic billing engine to event-driven Node.js and PostgreSQL microservices, reducing cloud infrastructure spend by 34% ($420k/yr saved).
• Mentored 9 engineers across 3 time zones and instituted automated end-to-end reliability testing.

Software Engineer II, Distributed Data | Vertex Telemetry (2019 – 2022)
• Designed high-throughput React and GraphQL observability dashboards rendering 50k+ real-time metrics/sec.
• Built containerized Python ingestion workers on Docker with zero-downtime schema migrations.

EDUCATION
B.S. in Computer Science | University of California, Berkeley`;

export const DEFAULT_LINKEDIN_SUMMARY = `Headline: Senior Full-Stack & AI Systems Engineer | Building Low-Latency Autonomous Agent Runtimes & High-Craft Developer Tools
Featured Posts & Endorsements: Top endorsed for TypeScript (48), Distributed Systems (39), LLM Orchestration (31), React (44), PostgreSQL (29).
About: Passionate about zero-to-one product engineering where distributed systems rigor meets intuitive human-in-the-loop AI interfaces. Seeking a high-autonomy Staff/Principal role at an engineering-led organization where I can own core agentic infrastructure while maintaining sustainable work-life balance.`;

export const INITIAL_CONSULTANT_MESSAGES: ConsultantChatMessage[] = [
  {
    id: 'consult-1',
    role: 'consultant',
    content:
      'Welcome to CareerHub. To eliminate manual data entry and minimize friction, I have already pre-loaded your existing Resume (Jordan_Vance_Base_Resume_2026.pdf) and LinkedIn Profile (linkedin.com/in/jordan-vance-ai). Click "Analyze Resume & LinkedIn Profile" above (or "1-Click Express: Analyze & Find Dream Jobs") so I can extract your core superpowers and match you with companies that will genuinely love having you on their team.',
    timestamp: '09:00 AM',
    extractedInsights: [
      'Resume & LinkedIn Pre-Loaded',
      'Mutual Company Fit Engine Active',
    ],
  },
  {
    id: 'consult-2',
    role: 'consultant',
    content:
      'From my initial pass of your Resume and LinkedIn activity, your rare combination of sub-450ms LLM pipeline architecture and high-density React/TypeScript execution makes you a dream hire for Series B–D AI platform teams. Tell me if you want to adjust your commute, work-life balance, or compensation targets—or launch the Job Search Agent right away.',
    timestamp: '09:01 AM',
  },
];

export const DEFAULT_CANDIDATE_PROFILE: CandidateProfile = {
  fullName: 'Jordan Vance',
  headline: 'Senior Full-Stack & AI Systems Engineer',
  yearsExperience: 7,
  skills: [
    'TypeScript',
    'React',
    'Node.js',
    'Python',
    'Distributed Systems',
    'PostgreSQL',
    'LLM Orchestration',
    'GraphQL',
    'Docker',
  ],
  targetRoles: [
    'Staff Software Engineer',
    'Senior AI Engineer',
    'Principal Full-Stack Engineer',
    'Founding Product Engineer',
  ],
  minSalaryK: 185,
  preferredWorkModes: ['Remote', 'Hybrid'],
  preferredLocations: ['San Francisco, CA', 'New York, NY', 'Seattle, WA', 'Remote'],
  bioSummary:
    '7+ years architecting low-latency web applications, multi-agent LLM pipelines, and high-throughput TypeScript/Python microservices. Proven track record leading cross-functional engineering squads from 0-to-1 product launch to enterprise scale.',
  keyAchievements: [
    'Architected a real-time AI document synthesis pipeline serving 140,000+ daily enterprise users with p95 latency under 450ms.',
    'Led migration of monolithic billing engine to event-driven Node.js & PostgreSQL services, reducing infrastructure spend by 34%.',
    'Mentored 9 engineers across 3 time zones and instituted automated end-to-end reliability testing.',
  ],
  baseResumeText: DEFAULT_BASE_RESUME,
  baseResumeFileName: 'Jordan_Vance_Base_Resume_2026.pdf',
  linkedInUrl: 'https://www.linkedin.com/in/jordan-vance-ai',
  linkedInSummary: DEFAULT_LINKEDIN_SUMMARY,
  profileAnalyzedAt: 'Oct 20, 2026 · 09:00 AM',
  consultationBlueprint: {
    corePassions: [
      'Autonomous AI Agent Architectures',
      'High-Craft Developer & Enterprise Interfaces',
      'Zero-to-One System Design',
    ],
    targetLocations: ['San Francisco, CA', 'Remote (US)', 'New York, NY'],
    maxCommuteMinutes: 25,
    workEnvironment:
      'High-autonomy engineering culture, Remote-first or flexible 2-day Hybrid',
    workLifeBalancePriority:
      'High priority — async-first collaboration, sustainable sprint cadence, protected deep-work hours',
    jobSecurityPriority:
      'Strong — Series B+ or profitable growth stage with 36+ months runway and proven enterprise customers',
    progressionGoal:
      'Staff-to-Principal technical leadership track with cross-org architectural ownership',
    compensationExpectation:
      '$185k–$245k base salary + meaningful equity grant & comprehensive health benefits',
    minSalaryK: 185,
    preferredWorkModes: ['Remote', 'Hybrid'],
    recommendedRoles: [
      'Staff AI Product Engineer',
      'Principal Full-Stack Systems Engineer',
      'Lead AI Platform Architect',
    ],
    consultantSummary:
      'Synthesized from Resume & LinkedIn: Jordan thrives in high-autonomy product engineering roles combining distributed LLM orchestration with responsive React interfaces, prioritizing remote/low-commute flexibility (<25 min), strong runway security, and a clear Staff/Principal IC progression path.',
    extractedSuperpowers: [
      '0-to-1 AI Agent & Distributed Systems Architecture (p95 < 450ms at 140k+ daily users)',
      'Full-Stack Product Ownership (React/TypeScript interfaces + Node.js/Python runtimes)',
      'High-ROI Infrastructure Optimization (34% cloud spend reduction via event-driven PostgreSQL)',
    ],
    idealCompanyDNA:
      'Engineering-led Series B–D or profitable AI/platform company where Staff/Principal ICs partner directly with founders and product leadership, ship without bureaucratic friction, and are valued for end-to-end architectural ownership.',
    dreamJobDefinition:
      'Principal or Staff AI Systems & Product Architect role with 100% Remote or low-commute Hybrid flexibility, $195k–$255k+ base + equity, high psychological safety, and a mandate to build human-centered autonomous workflows.',
  },
};

export const INITIAL_JOB_FEED: JobListing[] = [
  {
    id: 'li-901',
    title: 'Staff AI Product Engineer, Agent Workflows',
    company: 'Veridian Labs',
    location: 'San Francisco, CA',
    workMode: 'Remote',
    source: 'LinkedIn',
    sourceUrl: 'https://www.linkedin.com/jobs/search/?keywords=Staff+AI+Product+Engineer+Veridian',
    postedAt: '2h ago',
    postedHoursAgo: 2,
    salaryMinK: 210,
    salaryMaxK: 255,
    equity: '0.25% – 0.45%',
    requiredSkills: ['TypeScript', 'React', 'Node.js', 'LLM Orchestration', 'Distributed Systems'],
    preferredSkills: ['PostgreSQL', 'Python'],
    department: 'Autonomous Workflows',
    seniority: 'Staff (L6)',
    agentSummary:
      'Veridian Labs is scaling its enterprise agent orchestration runtime. The role owns both the streaming React execution canvas and the underlying Node.js/Python tool-use coordinator.',
    whyItMatches:
      'Matches 100% of required technical competencies (TypeScript, React, Node.js, LLM Orchestration) and exceeds your $185k salary floor by up to $70k while offering full Remote flexibility (0 min commute).',
    whyCompanyLovesYou:
      'Veridian’s VP of Engineering is specifically looking for a Staff IC who has already scaled a real-time LLM synthesis pipeline above 100k daily users with sub-500ms latency—making your Horizon Cloud achievement an immediate, rare plug-and-play fit.',
    dreamJobAlignment:
      'Checks every box of your Dream Job Blueprint: 100% Remote (zero commute), $210k–$255k base + 0.45% equity, async-first culture, and direct ownership of autonomous agent workflows.',
    keyResponsibilities: [
      'Architect resilient multi-step agent execution graphs with deterministic state recovery.',
      'Build high-density observability and human-in-the-loop approval interfaces in React & TypeScript.',
      'Partner directly with enterprise design partners to optimize prompt latency and token economics.',
    ],
    companyRating: 4.7,
    applicantsCount: 28,
    feedBatchDate: 'Oct 20 · Daily Morning Digest',
    commuteEstimate: '0 min (100% Remote)',
    workLifeBalanceNote: '4.8/5 WLB · Async-first culture, no weekend pages',
    securityAndProgressionNote: 'Series C ($140M raised) · Direct Staff-to-Principal IC track',
  },
  {
    id: 'gd-402',
    title: 'Principal Full-Stack Systems Engineer',
    company: 'Kinetix Financial Technologies',
    location: 'New York, NY',
    workMode: 'Hybrid',
    source: 'Glassdoor',
    sourceUrl: 'https://www.glassdoor.com/Job/principal-full-stack-engineer-jobs-SRCH_KO0,29.htm',
    postedAt: '3h ago',
    postedHoursAgo: 3,
    salaryMinK: 200,
    salaryMaxK: 240,
    equity: 'RSU Annual Grant',
    requiredSkills: ['TypeScript', 'Node.js', 'PostgreSQL', 'Distributed Systems', 'React'],
    preferredSkills: ['GraphQL', 'Docker'],
    department: 'Institutional Clearing',
    seniority: 'Principal',
    agentSummary:
      'Lead engineering role inside Kinetix’s real-time treasury & settlement platform. Hybrid 2 days/week in NYC with high autonomy over ledger schema design and real-time portfolio dashboards.',
    whyItMatches:
      'Direct overlap with your billing migration achievement and PostgreSQL/Node.js distributed systems background. Compensation ceiling ($240k) is $55k above your minimum target.',
    whyCompanyLovesYou:
      'Kinetix is actively decomposing their legacy settlement monolith into event-driven Node.js/PostgreSQL services—the exact migration you led that saved 34% in cloud spend.',
    dreamJobAlignment:
      'Profitable $85M ARR stability, Principal-level architectural authority across 4 pods, and flexible 2-day hybrid schedule.',
    keyResponsibilities: [
      'Own the real-time settlement ledger API handling $4B+ in monthly institutional volume.',
      'Modernize client-facing treasury analytics workspaces using React 19 and GraphQL.',
      'Lead architecture reviews and establish service-level objectives across 4 core platform pods.',
    ],
    companyRating: 4.5,
    applicantsCount: 41,
    feedBatchDate: 'Oct 20 · Daily Morning Digest',
    commuteEstimate: '20 min (2 days/wk Hybrid)',
    workLifeBalanceNote: '4.4/5 WLB · Flexible core hours',
    securityAndProgressionNote: 'Profitable ($85M ARR) · Principal IC authority across 4 pods',
  },
  {
    id: 'ind-715',
    title: 'Senior Backend & LLM Infrastructure Engineer',
    company: 'Aether Health AI',
    location: 'Seattle, WA',
    workMode: 'Remote',
    source: 'Indeed',
    sourceUrl: 'https://www.indeed.com/jobs?q=Senior+LLM+Infrastructure+Engineer',
    postedAt: '4h ago',
    postedHoursAgo: 4,
    salaryMinK: 190,
    salaryMaxK: 225,
    equity: '0.15% – 0.30%',
    requiredSkills: ['Python', 'TypeScript', 'LLM Orchestration', 'PostgreSQL'],
    preferredSkills: ['Docker', 'Distributed Systems', 'Kubernetes'],
    department: 'Clinical Intelligence',
    seniority: 'Senior (L5)',
    agentSummary:
      'Remote-first healthcare AI platform automating clinical prior-authorizations and medical synthesis. Heavy focus on HIPAA-compliant retrieval pipelines and structured extraction.',
    whyItMatches:
      'Strong alignment with your 140k-user document synthesis achievement. Offers Remote work and a $190k–$225k base range that clears your $185k baseline.',
    whyCompanyLovesYou:
      'Aether’s clinical synthesis team needs an engineer who understands deterministic citation grounding and PostgreSQL scale in production.',
    dreamJobAlignment:
      'High-meaning healthcare impact, 100% Remote, and protected 4-day deep-work engineering blocks.',
    keyResponsibilities: [
      'Design high-precision clinical document extraction and grounding pipelines in Python & TypeScript.',
      'Implement automated evaluation harnesses for citation accuracy and latency regression testing.',
      'Scale PostgreSQL vector and relational storage for multi-tenant hospital networks.',
    ],
    companyRating: 4.6,
    applicantsCount: 19,
    feedBatchDate: 'Oct 20 · Daily Morning Digest',
    commuteEstimate: '0 min (100% Remote)',
    workLifeBalanceNote: '4.7/5 WLB · 4-day deep work focus blocks',
    securityAndProgressionNote: 'Series B ($62M runway) · Fast-track to Staff Engineer in 12 mos',
  },
  {
    id: 'li-908',
    title: 'Staff Frontend & Design Systems Architect',
    company: 'Chronicle Data',
    location: 'San Francisco, CA',
    workMode: 'Hybrid',
    source: 'LinkedIn',
    sourceUrl: 'https://www.linkedin.com/jobs/search/?keywords=Staff+Frontend+Architect+Chronicle',
    postedAt: '5h ago',
    postedHoursAgo: 5,
    salaryMinK: 185,
    salaryMaxK: 215,
    equity: '0.10% – 0.25%',
    requiredSkills: ['TypeScript', 'React', 'GraphQL'],
    preferredSkills: ['Node.js', 'WebGL', 'Performance Profiling'],
    department: 'Observability UI',
    seniority: 'Staff',
    agentSummary:
      'Chronicle builds high-throughput telemetry exploration tools. Seeking a Staff UI Architect to lead their high-density tabular data grid and query builder experience.',
    whyItMatches:
      'Matches core TypeScript, React, and GraphQL skills with a $185k–$215k base range in San Francisco (Hybrid 2 days/week).',
    whyCompanyLovesYou:
      'Your Vertex Telemetry background building 50k+ metrics/sec React & GraphQL observability dashboards maps directly to Chronicle’s core product.',
    dreamJobAlignment:
      'High-craft developer interface ownership with a short 18-minute SOMA commute 2 days/week.',
    keyResponsibilities: [
      'Own the virtualized data table engine capable of rendering 100k+ live telemetry rows at 60fps.',
      'Standardize accessibility, keyboard navigation, and design tokens across 18 product engineers.',
      'Collaborate with query-engine engineers to optimize GraphQL streaming subscriptions.',
    ],
    companyRating: 4.3,
    applicantsCount: 54,
    feedBatchDate: 'Oct 20 · Daily Morning Digest',
    commuteEstimate: '18 min SOMA transit (2 days/wk)',
    workLifeBalanceNote: '4.3/5 WLB · Standard West Coast hours',
    securityAndProgressionNote: 'Series B · High visibility across product org',
  },
  {
    id: 'gd-419',
    title: 'Founding Full-Stack Engineer (AI Developer Tools)',
    company: 'Anvil Runtime',
    location: 'Remote (US & Canada)',
    workMode: 'Remote',
    source: 'Glassdoor',
    sourceUrl: 'https://www.glassdoor.com/Job/founding-full-stack-engineer-jobs-SRCH_KO0,28.htm',
    postedAt: '6h ago',
    postedHoursAgo: 6,
    salaryMinK: 180,
    salaryMaxK: 210,
    equity: '0.75% – 1.25%',
    requiredSkills: ['TypeScript', 'React', 'Node.js', 'Docker'],
    preferredSkills: ['LLM Orchestration', 'Rust', 'PostgreSQL'],
    department: 'Core Product',
    seniority: 'Founding / Lead',
    agentSummary:
      'Series A developer tool startup building sandboxed cloud environments for autonomous code verification. High equity upside and direct product ownership alongside technical founders.',
    whyItMatches:
      'Hits your Founding Product Engineer target role and matches 100% of required skills, with a $210k top end and full Remote flexibility.',
    whyCompanyLovesYou:
      'Founders want a self-directed 0-to-1 builder who can own both Docker container orchestration and the React developer workspace.',
    dreamJobAlignment:
      'Outsized 1.25% founding equity upside and direct influence over product direction.',
    keyResponsibilities: [
      'Build container orchestration APIs and interactive browser terminal workspaces.',
      'Ship end-to-end features from database schema to developer CLI and web dashboard.',
      'Shape engineering culture and lead early customer onboarding calls.',
    ],
    companyRating: 4.8,
    applicantsCount: 33,
    feedBatchDate: 'Oct 20 · Daily Morning Digest',
    commuteEstimate: '0 min (100% Remote)',
    workLifeBalanceNote: '4.2/5 WLB · High ownership startup pace',
    securityAndProgressionNote: 'Series A ($28M led by tier-1 VC) · Founding Eng -> VP Eng path',
  },
  {
    id: 'ind-729',
    title: 'Senior Distributed Systems Engineer',
    company: 'Strata Cloud Storage',
    location: 'Austin, TX',
    workMode: 'On-site',
    source: 'Indeed',
    sourceUrl: 'https://www.indeed.com/jobs?q=Senior+Distributed+Systems+Engineer',
    postedAt: '8h ago',
    postedHoursAgo: 8,
    salaryMinK: 170,
    salaryMaxK: 195,
    equity: 'RSU Grant',
    requiredSkills: ['Distributed Systems', 'Python', 'Docker', 'Go'],
    preferredSkills: ['PostgreSQL', 'Kafka'],
    department: 'Storage Engine',
    seniority: 'Senior',
    agentSummary:
      'Core infrastructure team building object storage replication services. Requires 5 days/week on-site in Austin and heavy Go/Python systems programming.',
    whyItMatches:
      'Matches Distributed Systems, Python, and Docker, but ranked lower because it requires On-site attendance in Austin and lists Go as a primary requirement.',
    whyCompanyLovesYou:
      'Strong distributed data foundation, though role requires 5-day on-site presence.',
    keyResponsibilities: [
      'Maintain multi-region consensus and replication daemons.',
      'Participate in tier-1 storage on-call rotation and root-cause analysis.',
    ],
    companyRating: 4.1,
    applicantsCount: 62,
    feedBatchDate: 'Oct 20 · Daily Morning Digest',
    commuteEstimate: '35 min (5 days/wk On-site)',
    workLifeBalanceNote: '3.9/5 WLB · Includes tier-1 on-call rotation',
    securityAndProgressionNote: 'Public Enterprise · Stable RSU refreshers',
  },
  {
    id: 'li-922',
    title: 'Lead AI Platform Engineer',
    company: 'Novus Enterprise Search',
    location: 'New York, NY',
    workMode: 'Hybrid',
    source: 'LinkedIn',
    sourceUrl: 'https://www.linkedin.com/jobs/search/?keywords=Lead+AI+Platform+Engineer+Novus',
    postedAt: '11h ago',
    postedHoursAgo: 11,
    salaryMinK: 195,
    salaryMaxK: 235,
    equity: '0.20% – 0.35%',
    requiredSkills: ['Python', 'TypeScript', 'LLM Orchestration', 'Distributed Systems'],
    preferredSkills: ['React', 'PostgreSQL', 'GraphQL'],
    department: 'Search & Retrieval',
    seniority: 'Lead',
    agentSummary:
      'Novus indexes multimodal enterprise knowledge across Slack, Drive, and Jira. Seeking a Lead Engineer to scale their hybrid semantic + keyword retrieval pipeline.',
    whyItMatches:
      'Matches 100% of required and preferred skills, aligns with Hybrid NYC preference, and offers up to $235k base salary.',
    whyCompanyLovesYou:
      'Your cross-timezone mentorship of 9 engineers and deep LLM retrieval background make you an ideal technical lead for Novus’s core search pod.',
    dreamJobAlignment:
      'Combines technical leadership with hands-on AI architecture in a stable Series C environment.',
    keyResponsibilities: [
      'Architect low-latency hybrid search ranking and permission-aware query execution.',
      'Partner with product teams to expose citation-grounded answers in the web client.',
      'Optimize embedding ingestion throughput across millions of enterprise documents.',
    ],
    companyRating: 4.5,
    applicantsCount: 37,
    feedBatchDate: 'Oct 20 · Daily Morning Digest',
    commuteEstimate: '15 min (Hybrid 2 days/wk)',
    workLifeBalanceNote: '4.6/5 WLB · Flexible hybrid schedule',
    securityAndProgressionNote: 'Series C ($110M valuation) · Lead to Principal track',
  },
];

export const INITIAL_APPLICATIONS: Record<string, ApplicationRecord> = {
  'li-901': {
    jobId: 'li-901',
    status: 'Saved',
    updatedAt: '2026-10-20T08:30:00Z',
    nextStep: 'Review tailored resume & cover letter, then confirm Auto-Apply Agent',
    notes: 'Agent flagged as #1 Dream Job & Mutual Fit match (99% alignment). Compensation ceiling is $255k.',
    autoTrackedByAgent: true,
    tailoredResumeDraft: `JORDAN VANCE
Senior Full-Stack & AI Systems Engineer · LinkedIn: https://www.linkedin.com/in/jordan-vance-ai
Target Role: Staff AI Product Engineer, Agent Workflows at Veridian Labs · Locations: San Francisco, CA | Remote (100% Remote Ready)

EXECUTIVE SUMMARY (TAILORED FOR VERIDIAN LABS)
7+ years architecting production systems in TypeScript, React, Node.js, LLM Orchestration, Distributed Systems, PostgreSQL, Python. Specifically aligned with Veridian Labs's Autonomous Workflows mandate: scaling enterprise agent orchestration runtimes and streaming React execution canvases.

WHY VERIDIAN LABS WILL LOVE HAVING YOU ON THE TEAM
• Veridian’s VP of Engineering is specifically looking for a Staff IC who has already scaled a real-time LLM synthesis pipeline above 100k daily users with sub-500ms latency—making your Horizon Cloud achievement an immediate, rare plug-and-play fit.

ROLE-ALIGNED TECHNICAL COMPETENCIES
• Primary Match for Veridian Labs: TypeScript · React · Node.js · LLM Orchestration · Distributed Systems · PostgreSQL · Python
• Additional Stack: GraphQL · Docker · Deterministic State Recovery · Prompt Latency Optimization

SELECTED QUANTIFIED IMPACT & EXPERIENCE
• Architected a real-time AI document synthesis pipeline serving 140,000+ daily enterprise users with p95 latency under 450ms.
• Led migration of monolithic billing engine to event-driven Node.js & PostgreSQL services, reducing infrastructure spend by 34%.
• Mentored 9 engineers across 3 time zones and instituted automated end-to-end reliability testing.`,
    coverLetterDraft: `Dear Hiring Team at Veridian Labs,

I am writing to express my strong interest in the Staff AI Product Engineer, Agent Workflows role. With over 7 years of experience architecting low-latency web applications and multi-agent LLM pipelines in TypeScript, React, Node.js, and Python, my background aligns directly with Veridian Labs' mission to scale reliable enterprise agent runtimes.

In my recent role, I architected a real-time AI document synthesis pipeline serving 140,000+ daily enterprise users with p95 latency under 450ms, and led the migration of a monolithic billing engine to event-driven Node.js and PostgreSQL services—reducing infrastructure spend by 34%. I thrive at the intersection of resilient distributed systems and high-density, human-in-the-loop React interfaces.

I would welcome the opportunity to discuss how my experience in deterministic agent orchestration and full-stack execution can accelerate Veridian Labs' roadmap.

Sincerely,
Jordan Vance`,
    agentPipelineLog: [
      'Career Consultant Agent analyzed Jordan_Vance_Base_Resume_2026.pdf + linkedin.com/in/jordan-vance-ai',
      'Job Search Agent indexed Dream Job from LinkedIn (99% overall · 99% mutual company fit)',
      'Resume Tailoring Agent generated role-specific resume highlighting sub-450ms LLM pipeline',
      'Cover Letter Agent drafted matching executive cover letter',
    ],
  },
  'gd-402': {
    jobId: 'gd-402',
    status: 'Applied',
    updatedAt: '2026-10-19T16:15:00Z',
    appliedAt: 'Oct 19, 2026',
    nextStep: 'Recruiter screen scheduled for Oct 23 at 2:00 PM EST',
    notes: 'Auto-Apply Agent submitted tailored resume + cover letter package.',
    autoTrackedByAgent: true,
    autoAppliedByAgent: true,
    confirmationId: 'MCA-APPLY-88412',
  },
  'ind-715': {
    jobId: 'ind-715',
    status: 'Interviewing',
    updatedAt: '2026-10-18T14:00:00Z',
    appliedAt: 'Oct 15, 2026',
    nextStep: 'System Design interview on Oct 22 (Clinical Retrieval Pipeline)',
    notes: 'Passed initial technical screen with VP of Engineering. Prepare architecture notes on p95 latency optimization.',
    autoTrackedByAgent: false,
  },
};
