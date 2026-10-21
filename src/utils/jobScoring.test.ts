import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyBlueprintToProfile,
  calculateJobMatch,
  computePipelineMetrics,
  extractResumeAndLinkedInSignals,
  formatSalaryRange,
  generateTailoredResumeText,
  prioritizeAndFilterJobs,
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
    whyItMatches: 'Matches 100% of required technical stack and exceeds $190k salary floor.',
    whyCompanyLovesYou: 'Your track record scaling ingestion pipelines to 50k RPS directly solves Linearity Cloud’s core bottleneck.',
    dreamJobAlignment: '100% Remote, high-autonomy AI agent architecture role.',
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
    whyItMatches: 'Strong match on TypeScript, Python, and PostgreSQL with $230k ceiling.',
    keyResponsibilities: ['Architect scientific compute workflows'],
    feedBatchDate: 'Today · Morning Scan',
  },
];

test('calculateJobMatch computes high alignment and mutualFitScore for dream job match', () => {
  const match1 = calculateJobMatch(sampleJobs[0], mockProfile);
  const match2 = calculateJobMatch(sampleJobs[1], mockProfile);

  assert.equal(match1.skillScore, 100);
  assert.ok(match1.mutualFitScore >= 90);
  assert.ok(match1.overallScore >= 90, `Expected >= 90, got ${match1.overallScore}`);
  assert.equal(match1.priorityTier, 'Priority 1 · Dream Job & Mutual Fit');

  assert.ok(match2.overallScore < 65, `Expected < 65 for low-salary on-site role, got ${match2.overallScore}`);
});

test('extractResumeAndLinkedInSignals detects skills and superpowers from resume + LinkedIn text', () => {
  const signals = extractResumeAndLinkedInSignals(
    mockProfile.baseResumeText,
    mockProfile.linkedInSummary,
    mockProfile
  );
  assert.ok(signals.detectedSkills.includes('Kubernetes'));
  assert.ok(signals.detectedSkills.includes('Rust'));
  assert.ok(signals.extractedSuperpowers.length >= 3);
  assert.ok(signals.idealCompanyDNA.length > 20);
  assert.ok(signals.dreamJobDefinition.length > 20);
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

test('generateTailoredResumeText weaves matched skills, whyCompanyLovesYou, and base resume into role-specific resume', () => {
  const scoredJob = {
    ...sampleJobs[0],
    match: calculateJobMatch(sampleJobs[0], mockProfile),
  };
  const tailored = generateTailoredResumeText(scoredJob, mockProfile);
  assert.ok(tailored.includes('LINEARITY CLOUD'));
  assert.ok(tailored.includes('WHY LINEARITY CLOUD WILL LOVE HAVING YOU ON THE TEAM'));
  assert.ok(tailored.includes('Alex_Rivera_Resume_2026.txt'));
});

test('computePipelineMetrics tallies tracked stages, tailored resumes, cover letters, and auto-applications', () => {
  const metrics = computePipelineMetrics({
    'job-1': {
      jobId: 'job-1',
      status: 'Applied',
      updatedAt: '2026-10-20',
      notes: 'Auto-applied with tailored package',
      tailoredResumeDraft: 'ALEX RIVERA — Tailored Resume for Linearity Cloud...',
      coverLetterDraft: 'Dear Linearity Cloud Hiring Team, I am excited to apply...',
      autoAppliedByAgent: true,
    },
  });

  assert.equal(metrics.totalTracked, 1);
  assert.equal(metrics.appliedCount, 1);
  assert.equal(metrics.resumesTailored, 1);
  assert.equal(metrics.autoAppliedCount, 1);
});

test('formatSalaryRange formats salary bounds cleanly', () => {
  assert.equal(formatSalaryRange(185, 225), '$185k–$225k');
});
