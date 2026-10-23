import {
  ApplicationRecord,
  CandidateProfile,
  ConsultationBlueprint,
  FilterState,
  JobListing,
  JobMatchBreakdown,
  ScoredJobListing,
} from '../types/career';
export { formatSalaryRange } from './localePreferences';

export function normalizeSkill(skill: string): string {
  return skill
    .trim()
    .toLowerCase()
    .replace(/[+#]+$/g, '')
    .replace(/\s+/g, ' ');
}

const SKILL_ALIASES: Record<string, string> = {
  ts: 'typescript',
  typescript: 'typescript',
  js: 'javascript',
  javascript: 'javascript',
  'node': 'node.js',
  nodejs: 'node.js',
  'node.js': 'node.js',
  react: 'react',
  reactjs: 'react',
  'react.js': 'react',
  golang: 'go',
  go: 'go',
  k8s: 'kubernetes',
  kubernetes: 'kubernetes',
  postgres: 'postgresql',
  postgresql: 'postgresql',
  py: 'python',
  python: 'python',
  'next': 'next.js',
  nextjs: 'next.js',
  'next.js': 'next.js',
  gcp: 'gcp',
  'google cloud': 'gcp',
  aws: 'aws',
  rust: 'rust',
  django: 'django',
};

export function canonicalSkill(skill: string): string {
  const normalized = normalizeSkill(skill);
  return SKILL_ALIASES[normalized] || normalized;
}

export function skillsMatch(candidateSkill: string, jobSkill: string): boolean {
  return canonicalSkill(candidateSkill) === canonicalSkill(jobSkill);
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
    minSalaryK: blueprint.minSalaryK ?? profile.minSalaryK,
    preferredCountry: blueprint.preferredCountry ?? profile.preferredCountry,
    homeLocation: blueprint.homeLocation ?? profile.homeLocation,
    salaryCurrency: blueprint.salaryCurrency ?? profile.salaryCurrency,
    timeZone: blueprint.timeZone ?? profile.timeZone,
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
      preferredCountry: blueprint.preferredCountry ?? profile.preferredCountry,
      homeLocation: blueprint.homeLocation ?? profile.homeLocation,
      salaryCurrency: blueprint.salaryCurrency ?? profile.salaryCurrency,
      timeZone: blueprint.timeZone ?? profile.timeZone,
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

  const displayName = (profile.fullName || 'Candidate').toUpperCase();
  const linkedIn = profile.linkedInUrl ? ` · LinkedIn: ${profile.linkedInUrl}` : '';
  const locations =
    profile.preferredLocations.length > 0
      ? profile.preferredLocations.join(' | ')
      : 'Not specified';
  const passions =
    bp?.corePassions?.filter(Boolean).slice(0, 2).join(' and ') || '';
  const achievements =
    profile.keyAchievements.length > 0
      ? profile.keyAchievements.map((ach) => `• ${ach}`).join('\n')
      : '• See base resume for experience details.';

  return `${displayName}
${profile.headline || ''}${linkedIn}
Target Role: ${job.title} at ${job.company} · Locations: ${locations} (${job.workMode})

EXECUTIVE SUMMARY (TAILORED FOR ${job.company.toUpperCase()})
${profile.yearsExperience > 0 ? `${profile.yearsExperience}+ years. ` : ''}${
    matched.length > 0 ? `Relevant skills: ${matched.join(', ')}. ` : ''
  }${job.agentSummary || ''}${passions ? ` Focus areas: ${passions}.` : ''}

ROLE-ALIGNED TECHNICAL COMPETENCIES
• Overlap with this posting: ${matched.join(' · ') || 'See base resume'}
• Additional skills: ${additionalSkills.join(' · ') || 'See base resume'}

SELECTED IMPACT
${achievements}

BASE RESUME (${profile.baseResumeFileName || 'Uploaded Resume'})
${(profile.baseResumeText || '').trim()}`;
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
    const isMatched = Array.from(candidateSkillsSet).some((cs) =>
      skillsMatch(cs, skill)
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

  const salaryUnknown = job.salaryMaxK === 0 && job.salaryMinK === 0;
  const salaryMidpoint = salaryUnknown
    ? 0
    : (job.salaryMinK + job.salaryMaxK) / 2;
  const salaryDeltaK = salaryUnknown
    ? 0
    : Math.round(job.salaryMaxK - profile.minSalaryK);
  let salaryScore = 100;

  if (salaryUnknown) {
    salaryScore = 70;
  } else if (profile.minSalaryK <= 0) {
    salaryScore = 80;
  } else if (
    job.salaryMaxK >= profile.minSalaryK &&
    salaryMidpoint >= profile.minSalaryK
  ) {
    const bonus = Math.min(
      10,
      Math.round((salaryMidpoint - profile.minSalaryK) / 5)
    );
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
  const commuteScore = scoreCommuteAndLocation(job, profile);

  const rawOverall =
    skillScore * 0.4 +
    salaryScore * 0.25 +
    workModeScore * 0.15 +
    commuteScore * 0.2 +
    roleBonus;
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
    commuteScore,
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
    const salaryUnknown = job.salaryMaxK === 0 && job.salaryMinK === 0;
    if (!salaryUnknown && job.salaryMaxK < filters.minSalaryK) {
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
  };
}

export function scoreCommuteAndLocation(
  job: JobListing,
  profile: CandidateProfile
): number {
  const maxMinutes = profile.consultationBlueprint?.maxCommuteMinutes;
  const home = profile.consultationBlueprint?.homeLocation || profile.homeLocation || '';

  if (job.workMode === 'Remote') {
    return 100;
  }

  if (typeof maxMinutes === 'number' && maxMinutes === 0) {
    return job.workMode === 'Hybrid' ? 35 : 15;
  }
  if (!home.trim()) return 60;

  const parts = (value: string) => value.toLocaleLowerCase().split(/[;,]/).map(part => part.trim()).filter(Boolean);
  const homeParts = parts(home);
  const jobParts = parts(job.location);
  if (!homeParts.length || !jobParts.length) return 60;
  const homeCity = homeParts[0];
  const jobCity = jobParts[0];
  if (homeCity === jobCity || homeCity.includes(jobCity) || jobCity.includes(homeCity)) {
    return job.workMode === 'Hybrid' ? 92 : 86;
  }
  const sharedRegion = homeParts.slice(1).some(part => jobParts.slice(1).includes(part));
  if (sharedRegion) return job.workMode === 'Hybrid' ? 68 : 58;
  return job.workMode === 'Hybrid' ? 32 : 24;
}

