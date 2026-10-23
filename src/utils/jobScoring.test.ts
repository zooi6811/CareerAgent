import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyBlueprintToProfile,
  calculateJobMatch,
  computePipelineMetrics,
  formatSalaryRange,
  generateTailoredResumeText,
  prioritizeAndFilterJobs,
  skillsMatch,
} from './jobScoring';
import {
  CandidateProfile,
  ConsultationBlueprint,
  FilterState,
  JobListing,
} from '../types/career';

const defaultBlueprint: ConsultationBlueprint = {
  corePassions: ['Autonomous AI Agents', 'Developer Productivity', 'Distributed Systems'],
  targetLocations: ['San Francisco, CA', 'Remote'],
  maxCommuteMinutes: 25,
  workEnvironment: 'High-autonomy engineering culture, Remote or flexible Hybrid',
  workLifeBalancePriority: 'Sustainable pace, async-first communication, protected deep-work blocks',
  jobSecurityPriority: 'Series B+ or profitable enterprise revenue with 36+ months runway',
  progressionGoal: 'Staff-to-Principal technical leadership track with architectural ownership',
  compensationExpectation: '$195k+ base salary with meaningful equity upside',
  minSalaryK: 190,
  preferredWorkModes: ['Remote', 'Hybrid'],
  recommendedRoles: ['Staff Software Engineer', 'Principal AI Engineer'],
  consultantSummary: 'Passionate about building autonomous AI agent runtimes with high architectural ownership and sustainable work-life balance.',
  extractedSuperpowers: ['0-to-1 AI Agent & Distributed Systems Architecture'],
  idealCompanyDNA: 'Engineering-led Series B–D AI company with high IC autonomy',
  dreamJobDefinition: 'Principal AI Systems Architect with 100% Remote flexibility',
};

const mockProfile: CandidateProfile = {
  fullName: 'Alex Rivera',
  headline: 'Staff Full-Stack & AI Systems Engineer',
  yearsExperience: 8,
  skills: ['TypeScript', 'React', 'Node.js', 'Python', 'Distributed Systems', 'PostgreSQL'],
  targetRoles: ['Staff Software Engineer', 'Principal AI Engineer'],
  minSalaryK: 190,
  preferredWorkModes: ['Remote', 'Hybrid'],
  preferredLocations: ['San Francisco, CA', 'Remote'],
  homeLocation: 'San Francisco, CA',
  bioSummary: '8 years building distributed systems and AI agent workflows.',
  keyAchievements: ['Scaled ingestion pipeline to 50k RPS'],
  baseResumeText: 'EXPERIENCE: Staff Engineer at CloudScale (2022-2026) — Built TypeScript & Python distributed pipelines and mentored 8 engineers.',
  baseResumeFileName: 'Alex_Rivera_Resume_2026.txt',
  linkedInUrl: 'https://www.linkedin.com/in/alex-rivera-ai',
  linkedInSummary: 'Staff Engineer specializing in Kubernetes, Rust, and Autonomous AI Agents.',
  consultationBlueprint: defaultBlueprint,
};

const sampleJobs: JobListing[] = [
  {
    id: 'job-1',
    title: 'Staff Software Engineer, AI Platform',
    company: 'Linearity Cloud',
    location: 'San Francisco, CA',
    workMode: 'Remote',
    source: 'LinkedIn',
    sourceUrl: 'https://www.linkedin.com/jobs/view/linearity-staff-ai',
    postedAt: '2h ago',
    postedHoursAgo: 2,
    salaryMinK: 205,
    salaryMaxK: 245,
    requiredSkills: ['TypeScript', 'React', 'Node.js', 'Distributed Systems'],
    preferredSkills: ['PostgreSQL', 'Python'],
    department: 'Core Platform',
    seniority: 'Staff',
    agentSummary: 'High-impact architecture role leading autonomous AI agent runtime services.',
    whyItMatches: 'Matches required technical stack and salary floor.',
    whyCompanyLovesYou: 'Pipeline scaling experience may overlap this role — AI-generated, not verified.',
    dreamJobAlignment: '100% Remote AI architecture role.',
    keyResponsibilities: ['Design distributed agent execution engine'],
    feedBatchDate: 'Today · Morning Scan',
  },
  {
    id: 'job-2',
    title: 'Senior Frontend Developer',
    company: 'Harbor Retail Systems',
    location: 'Austin, TX',
    workMode: 'On-site',
    source: 'Indeed',
    sourceUrl: 'https://www.indeed.com/viewjob?jk=harbor-fe',
    postedAt: '9h ago',
    postedHoursAgo: 9,
    salaryMinK: 135,
    salaryMaxK: 155,
    requiredSkills: ['React', 'Ruby on Rails', 'GraphQL'],
    preferredSkills: ['CSS'],
    department: 'Storefront',
    seniority: 'Senior',
    agentSummary: 'On-site frontend role focused on retail checkout flows.',
    whyItMatches: 'Matches React, but below target salary and requires On-site.',
    keyResponsibilities: ['Maintain storefront UI'],
    feedBatchDate: 'Today · Morning Scan',
  },
  {
    id: 'job-3',
    title: 'Principal Full-Stack Engineer',
    company: 'Vektor Bio',
    location: 'New York, NY',
    workMode: 'Hybrid',
    source: 'Glassdoor',
    sourceUrl: 'https://www.glassdoor.com/job-listing/vektor-bio',
    postedAt: '4h ago',
    postedHoursAgo: 4,
    salaryMinK: 195,
    salaryMaxK: 230,
    requiredSkills: ['TypeScript', 'Python', 'PostgreSQL'],
    preferredSkills: ['React', 'Kubernetes'],
    department: 'R&D Informatics',
    seniority: 'Principal',
    agentSummary: 'Hybrid principal engineering position building scientific data portals.',
    whyItMatches: 'Strong match on TypeScript, Python, and PostgreSQL.',
    keyResponsibilities: ['Architect scientific compute workflows'],
    feedBatchDate: 'Today · Morning Scan',
  },
];

test('calculateJobMatch computes high alignment and mutualFitScore for dream job match', () => {
  const match1 = calculateJobMatch(sampleJobs[0], mockProfile);
  const match2 = calculateJobMatch(sampleJobs[1], mockProfile);

  assert.equal(match1.skillScore, 100);
  assert.ok(match1.mutualFitScore >= 90);
  assert.ok(match1.overallScore >= 85, `Expected >= 85, got ${match1.overallScore}`);
  assert.equal(match1.priorityTier, 'Priority 1 · Dream Job & Mutual Fit');

  assert.ok(match2.overallScore < 65, `Expected < 65 for low-salary on-site role, got ${match2.overallScore}`);
});

test('skill matching is exact after alias normalisation (Go does not match Django)', () => {
  assert.equal(skillsMatch('Go', 'Django'), false);
  assert.equal(skillsMatch('Rust', 'trust'), false);
  assert.equal(skillsMatch('Go', 'Golang'), true);
  assert.equal(skillsMatch('Node', 'Node.js'), true);

  const goProfile: CandidateProfile = { ...mockProfile, skills: ['Go'] };
  const djangoJob: JobListing = {
    ...sampleJobs[0],
    requiredSkills: ['Django'],
    preferredSkills: [],
  };
  const match = calculateJobMatch(djangoJob, goProfile);
  assert.equal(match.matchedSkills.length, 0);
  assert.ok(match.missingSkills.includes('Django'));
});

test('unknown salary is scored neutrally and is not filtered by the minimum-salary filter', () => {
  const unknownSalaryJob: JobListing = {
    ...sampleJobs[0],
    salaryMinK: 0,
    salaryMaxK: 0,
  };
  const match = calculateJobMatch(unknownSalaryJob, mockProfile);
  assert.equal(match.salaryScore, 70);
  assert.equal(formatSalaryRange(0, 0), 'Not listed');

  const filter: FilterState = {
    workMode: 'All',
    source: 'All',
    minSalaryK: 190,
    searchQuery: '',
    sortBy: 'priority',
    onlyPriorityOne: false,
  };
  const results = prioritizeAndFilterJobs([unknownSalaryJob], mockProfile, filter);
  assert.equal(results.length, 1);
});

test('remote jobs score full commute; distant on-site scores lower', () => {
  const remoteMatch = calculateJobMatch(sampleJobs[0], mockProfile);
  assert.equal(remoteMatch.commuteScore, 100);

  const distantOnsite = calculateJobMatch(sampleJobs[1], mockProfile);
  assert.ok(distantOnsite.commuteScore < 50);

  const localHybrid: JobListing = {
    ...sampleJobs[2],
    location: 'San Francisco, CA',
    workMode: 'Hybrid',
  };
  const localMatch = calculateJobMatch(localHybrid, mockProfile);
  assert.ok(localMatch.commuteScore > distantOnsite.commuteScore);

  const nearbyOnsite = { ...sampleJobs[1], location: 'San Francisco, CA', workMode: 'On-site' as const };
  assert.ok(calculateJobMatch(nearbyOnsite, mockProfile).commuteScore > distantOnsite.commuteScore);

  const shorterBudgetProfile: CandidateProfile = {
    ...mockProfile,
    consultationBlueprint: { ...defaultBlueprint, maxCommuteMinutes: 10 },
  };
  const longerBudgetProfile: CandidateProfile = {
    ...mockProfile,
    consultationBlueprint: { ...defaultBlueprint, maxCommuteMinutes: 55 },
  };
  assert.equal(
    calculateJobMatch(localHybrid, longerBudgetProfile).commuteScore,
    calculateJobMatch(localHybrid, shorterBudgetProfile).commuteScore
  );
});

test('commute fit uses the home base and stays neutral without it', () => {
  const job = { ...sampleJobs[1], location: 'Austin, TX', workMode: 'On-site' as const };
  const withoutHome = { ...mockProfile, homeLocation: '', preferredLocations: ['Austin, TX'], consultationBlueprint: { ...defaultBlueprint, targetLocations: ['Austin, TX'] } };
  const withHome = { ...withoutHome, homeLocation: 'San Francisco, CA' };
  assert.equal(calculateJobMatch(job, withoutHome).commuteScore, 60);
  assert.equal(calculateJobMatch(job, withHome).commuteScore, 24);
});

test('prioritizeAndFilterJobs filters by Remote/Hybrid and source accurately', () => {
  const remoteFilter: FilterState = {
    workMode: 'Remote',
    source: 'All',
    minSalaryK: 0,
    searchQuery: '',
    sortBy: 'priority',
    onlyPriorityOne: false,
  };

  const remoteResults = prioritizeAndFilterJobs(sampleJobs, mockProfile, remoteFilter);
  assert.equal(remoteResults.length, 1);
  assert.equal(remoteResults[0].id, 'job-1');
});

test('applyBlueprintToProfile synchronizes consultation blueprint into candidate profile', () => {
  const updatedBlueprint: ConsultationBlueprint = {
    ...defaultBlueprint,
    minSalaryK: 215,
    preferredWorkModes: ['Remote'],
    recommendedRoles: ['Founding AI Architect'],
  };
  const updatedProfile = applyBlueprintToProfile(mockProfile, updatedBlueprint);
  assert.equal(updatedProfile.minSalaryK, 215);
  assert.deepEqual(updatedProfile.preferredWorkModes, ['Remote']);
  assert.ok(updatedProfile.targetRoles.includes('Founding AI Architect'));
});

test('generateTailoredResumeText stays grounded and omits unverifiable company-love claims', () => {
  const scoredJob = {
    ...sampleJobs[0],
    match: calculateJobMatch(sampleJobs[0], mockProfile),
  };
  const tailored = generateTailoredResumeText(scoredJob, mockProfile);
  assert.ok(tailored.includes('LINEARITY CLOUD'));
  assert.equal(tailored.includes('WILL LOVE HAVING YOU ON THE TEAM'), false);
  assert.equal(tailored.includes('VP of Engineering'), false);
  assert.ok(tailored.includes('Alex_Rivera_Resume_2026.txt'));
});

test('computePipelineMetrics tallies tracked stages and prepared documents', () => {
  const metrics = computePipelineMetrics({
    'job-1': {
      jobId: 'job-1',
      status: 'Applied',
      updatedAt: '2026-10-20',
      notes: 'Submitted on the job board after preparing the package',
      tailoredResumeDraft: 'ALEX RIVERA — Tailored Resume for Linearity Cloud...',
      coverLetterDraft: 'Dear Linearity Cloud Hiring Team, I am excited to apply...',
    },
  });

  assert.equal(metrics.totalTracked, 1);
  assert.equal(metrics.appliedCount, 1);
  assert.equal(metrics.resumesTailored, 1);
});

test('formatSalaryRange formats salary bounds cleanly', () => {
  const formatted = formatSalaryRange(185, 225, 'USD');
  assert.ok(formatted.includes('185,000') && formatted.includes('225,000') && formatted.includes('/ year'));
  assert.equal(formatSalaryRange(0, 0, 'MYR'), 'Not listed');
});
