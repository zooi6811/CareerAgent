import {
  ApplicationRecord,
  CandidateProfile,
  ConsultationBlueprint,
  FilterState,
  JobListing,
  JobMatchBreakdown,
  ScoredJobListing,
} from '../types/career';

export function normalizeSkill(skill: string): string {
  return skill.trim().toLowerCase();
}

export const KNOWN_TECH_SKILLS = [
  'TypeScript',
  'React',
  'Node.js',
  'Python',
  'Distributed Systems',
  'PostgreSQL',
  'LLM Orchestration',
  'GraphQL',
  'Docker',
  'Kubernetes',
  'Rust',
  'Go',
  'PyTorch',
  'Next.js',
  'AWS',
  'GCP',
  'Kafka',
  'Redis',
  'Terraform',
];

export function extractResumeAndLinkedInSignals(
  resumeText: string,
  linkedInSummary: string,
  currentProfile: CandidateProfile
): {
  detectedSkills: string[];
  extractedSuperpowers: string[];
  idealCompanyDNA: string;
  dreamJobDefinition: string;
  recommendedRoles: string[];
} {
  const combined = `${resumeText} ${linkedInSummary}`.toLowerCase();

  const detectedSkills = Array.from(
    new Set([
      ...currentProfile.skills,
      ...KNOWN_TECH_SKILLS.filter((skill) =>
        combined.includes(skill.toLowerCase())
      ),
    ])
  );

  const extractedSuperpowers: string[] = [
    '0-to-1 AI Agent & Distributed Systems Architecture (p95 < 450ms at 140k+ daily users)',
    'Full-Stack Product Ownership (React/TypeScript interfaces + Node.js/Python runtimes)',
    'High-ROI Infrastructure Optimization (34% cloud spend reduction via event-driven PostgreSQL)',
  ];

  if (combined.includes('mentor') || combined.includes('lead')) {
    extractedSuperpowers.push(
      'Cross-Timezone Technical Mentorship & Engineering Reliability Leadership'
    );
  }

  const idealCompanyDNA =
    'Engineering-led Series B–D or profitable AI/platform company where Staff/Principal ICs partner directly with founders and product leadership, ship without bureaucratic friction, and are valued for end-to-end architectural ownership.';

  const dreamJobDefinition =
    'Principal or Staff AI Systems & Product Architect role with 100% Remote or low-commute Hybrid flexibility, $195k–$255k+ base + equity, high psychological safety, and a mandate to build human-centered autonomous workflows.';

  const recommendedRoles = [
    'Staff AI Product Engineer',
    'Principal Full-Stack Systems Architect',
    'Lead Autonomous Systems Engineer',
    'Founding AI Platform Engineer',
  ];

  return {
    detectedSkills,
    extractedSuperpowers,
    idealCompanyDNA,
    dreamJobDefinition,
    recommendedRoles,
  };
}

export function applyBlueprintToProfile(
  profile: CandidateProfile,
  blueprint: ConsultationBlueprint
): CandidateProfile {
  const mergedRoles = Array.from(
    new Set([...blueprint.recommendedRoles, ...profile.targetRoles])
  ).slice(0, 6);

  return {
    ...profile,
    minSalaryK: blueprint.minSalaryK || profile.minSalaryK,
    preferredWorkModes:
      blueprint.preferredWorkModes.length > 0
        ? blueprint.preferredWorkModes
        : profile.preferredWorkModes,
    preferredLocations:
      blueprint.targetLocations.length > 0
        ? blueprint.targetLocations
        : profile.preferredLocations,
    targetRoles: mergedRoles,
    consultationBlueprint: {
      ...blueprint,
      lastCompletedAt: new Date().toISOString(),
    },
  };
}

export function generateTailoredResumeText(
  job: ScoredJobListing,
  profile: CandidateProfile
): string {
  const bp = profile.consultationBlueprint;
  const matched =
    job.match.matchedSkills.length > 0
      ? job.match.matchedSkills
      : profile.skills.slice(0, 6);
  const additionalSkills = profile.skills.filter((s) => !matched.includes(s));

  return `${profile.fullName.toUpperCase()}
${profile.headline} · LinkedIn: ${profile.linkedInUrl || 'linkedin.com/in/jordan-vance-ai'}
Target Role: ${job.title} at ${job.company} · Locations: ${profile.preferredLocations.join(' | ')} (${job.workMode} Ready)

EXECUTIVE SUMMARY (TAILORED FOR ${job.company.toUpperCase()})
${profile.yearsExperience}+ years architecting production systems in ${matched.join(', ')}. Specifically aligned with ${job.company}'s ${job.department} mandate: ${job.agentSummary} Driven by core focus in ${bp?.corePassions?.slice(0, 2).join(' and ') || 'autonomous AI systems and resilient distributed infrastructure'}.

WHY ${job.company.toUpperCase()} WILL LOVE HAVING YOU ON THE TEAM
• ${job.whyCompanyLovesYou || `Direct track record solving ${job.company}'s exact scaling and product velocity challenges in ${matched.slice(0, 3).join(', ')}.`}

ROLE-ALIGNED TECHNICAL COMPETENCIES
• Primary Match for ${job.company}: ${matched.join(' · ')}
• Additional Stack & Tooling: ${additionalSkills.join(' · ') || 'System Design · CI/CD · Observability'}

SELECTED QUANTIFIED IMPACT & EXPERIENCE
${profile.keyAchievements.map((ach) => `• ${ach}`).join('\n')}
• Direct Role Alignment (${job.title}): Prepared to immediately ${
    job.keyResponsibilities[0]
      ? job.keyResponsibilities[0].charAt(0).toLowerCase() +
        job.keyResponsibilities[0].slice(1)
      : 'lead core architecture and end-to-end product delivery.'
  }

BASE RESUME FOUNDATION (${profile.baseResumeFileName || 'Uploaded Resume'})
${profile.baseResumeText.trim()}`;
}

export function calculateJobMatch(
  job: JobListing,
  profile: CandidateProfile
): JobMatchBreakdown {
  const candidateSkillsSet = new Set(profile.skills.map(normalizeSkill));

  const allJobSkills = Array.from(
    new Set([...job.requiredSkills, ...job.preferredSkills])
  );

  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  for (const skill of allJobSkills) {
    const norm = normalizeSkill(skill);
    const isMatched = Array.from(candidateSkillsSet).some(
      (cs) => cs === norm || cs.includes(norm) || norm.includes(cs)
    );
    if (isMatched) {
      matchedSkills.push(skill);
    } else {
      missingSkills.push(skill);
    }
  }

  const requiredMatches = job.requiredSkills.filter((req) =>
    matchedSkills.includes(req)
  ).length;
  const requiredRatio =
    job.requiredSkills.length > 0
      ? requiredMatches / job.requiredSkills.length
      : 1;
  const totalRatio =
    allJobSkills.length > 0 ? matchedSkills.length / allJobSkills.length : 1;

  const skillScore = Math.round((requiredRatio * 0.75 + totalRatio * 0.25) * 100);

  const salaryMidpoint = (job.salaryMinK + job.salaryMaxK) / 2;
  const salaryDeltaK = Math.round(job.salaryMaxK - profile.minSalaryK);
  let salaryScore = 100;

  if (job.salaryMaxK >= profile.minSalaryK && salaryMidpoint >= profile.minSalaryK) {
    const bonus = Math.min(10, Math.round((salaryMidpoint - profile.minSalaryK) / 5));
    salaryScore = Math.min(100, 92 + Math.max(0, bonus));
  } else if (job.salaryMaxK >= profile.minSalaryK) {
    salaryScore = 84;
  } else {
    const deficit = profile.minSalaryK - job.salaryMaxK;
    salaryScore = Math.max(20, Math.round(80 - deficit * 1.8));
  }

  const workModeScore = profile.preferredWorkModes.includes(job.workMode)
    ? 100
    : job.workMode === 'Hybrid' && profile.preferredWorkModes.includes('Remote')
    ? 68
    : 40;

  const titleNorm = job.title.toLowerCase();
  const matchesTargetRole = profile.targetRoles.some((role) => {
    const keywords = role
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);
    return keywords.some((kw) => titleNorm.includes(kw));
  });

  const passions = profile.consultationBlueprint?.corePassions || [];
  const jobText = `${job.title} ${job.department} ${job.agentSummary}`.toLowerCase();
  const matchesPassion = passions.some((p) =>
    p
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .some((kw) => jobText.includes(kw))
  );

  const roleBonus = (matchesTargetRole ? 4 : 0) + (matchesPassion ? 3 : 0);

  const rawOverall =
    skillScore * 0.5 + salaryScore * 0.3 + workModeScore * 0.2 + roleBonus;
  const overallScore = Math.max(15, Math.min(99, Math.round(rawOverall)));

  // Mutual Fit Score measures how strongly the company's needs + culture match the candidate's superpowers
  const mutualFitScore = Math.max(
    25,
    Math.min(
      99,
      Math.round(skillScore * 0.6 + workModeScore * 0.25 + (matchesPassion ? 15 : 8))
    )
  );

  let priorityTier: JobMatchBreakdown['priorityTier'] =
    'Priority 3 · Exploratory';
  if (overallScore >= 85) {
    priorityTier = 'Priority 1 · Dream Job & Mutual Fit';
  } else if (overallScore >= 70) {
    priorityTier = 'Priority 2 · Strong Fit';
  }

  return {
    overallScore,
    skillScore,
    salaryScore,
    workModeScore,
    mutualFitScore,
    matchedSkills,
    missingSkills,
    salaryDeltaK,
    priorityTier,
  };
}

export function prioritizeAndFilterJobs(
  jobs: JobListing[],
  profile: CandidateProfile,
  filters: FilterState
): ScoredJobListing[] {
  const scored: ScoredJobListing[] = jobs.map((job) => ({
    ...job,
    match: calculateJobMatch(job, profile),
  }));

  const query = filters.searchQuery.trim().toLowerCase();

  const filtered = scored.filter((job) => {
    if (filters.workMode !== 'All' && job.workMode !== filters.workMode) {
      return false;
    }
    if (filters.source !== 'All' && job.source !== filters.source) {
      return false;
    }
    if (job.salaryMaxK < filters.minSalaryK) {
      return false;
    }
    if (
      filters.onlyPriorityOne &&
      job.match.priorityTier !== 'Priority 1 · Dream Job & Mutual Fit'
    ) {
      return false;
    }
    if (query.length > 0) {
      const searchable = [
        job.title,
        job.company,
        job.location,
        job.department,
        job.agentSummary,
        ...job.requiredSkills,
        ...job.preferredSkills,
      ]
        .join(' ')
        .toLowerCase();
      if (!searchable.includes(query)) {
        return false;
      }
    }
    return true;
  });

  return filtered.sort((a, b) => {
    if (filters.sortBy === 'salary') {
      if (b.salaryMaxK !== a.salaryMaxK) return b.salaryMaxK - a.salaryMaxK;
      return b.match.overallScore - a.match.overallScore;
    }
    if (filters.sortBy === 'recent') {
      if (a.postedHoursAgo !== b.postedHoursAgo) {
        return a.postedHoursAgo - b.postedHoursAgo;
      }
      return b.match.overallScore - a.match.overallScore;
    }
    if (b.match.overallScore !== a.match.overallScore) {
      return b.match.overallScore - a.match.overallScore;
    }
    if (b.salaryMaxK !== a.salaryMaxK) {
      return b.salaryMaxK - a.salaryMaxK;
    }
    return a.postedHoursAgo - b.postedHoursAgo;
  });
}

export interface PipelineMetrics {
  totalTracked: number;
  savedCount: number;
  appliedCount: number;
  interviewingCount: number;
  offerCount: number;
  archivedCount: number;
  coverLettersDrafted: number;
  resumesTailored: number;
  autoAppliedCount: number;
}

export function computePipelineMetrics(
  applications: Record<string, ApplicationRecord>
): PipelineMetrics {
  const records = Object.values(applications).filter(
    (r) => r.status !== 'Untracked'
  );

  let savedCount = 0;
  let appliedCount = 0;
  let interviewingCount = 0;
  let offerCount = 0;
  let archivedCount = 0;
  let coverLettersDrafted = 0;
  let resumesTailored = 0;
  let autoAppliedCount = 0;

  for (const rec of records) {
    if (rec.status === 'Saved') savedCount++;
    if (rec.status === 'Applied') appliedCount++;
    if (rec.status === 'Interviewing') interviewingCount++;
    if (rec.status === 'Offer') offerCount++;
    if (rec.status === 'Archived') archivedCount++;
    if (rec.coverLetterDraft && rec.coverLetterDraft.trim().length > 20) {
      coverLettersDrafted++;
    }
    if (rec.tailoredResumeDraft && rec.tailoredResumeDraft.trim().length > 20) {
      resumesTailored++;
    }
    if (rec.autoAppliedByAgent) {
      autoAppliedCount++;
    }
  }

  return {
    totalTracked: records.length,
    savedCount,
    appliedCount,
    interviewingCount,
    offerCount,
    archivedCount,
    coverLettersDrafted,
    resumesTailored,
    autoAppliedCount,
  };
}

export function formatSalaryRange(minK: number, maxK: number): string {
  return `$${minK}k–$${maxK}k`;
}
