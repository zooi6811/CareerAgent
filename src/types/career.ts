export type JobSource = 'LinkedIn' | 'Indeed' | 'Glassdoor';

export type WorkMode = 'Remote' | 'Hybrid' | 'On-site';

export type ApplicationStatus =
  | 'Untracked'
  | 'Saved'
  | 'Applied'
  | 'Interviewing'
  | 'Offer'
  | 'Archived';

export interface ConsultationBlueprint {
  corePassions: string[];
  targetLocations: string[];
  maxCommuteMinutes: number;
  workEnvironment: string;
  workLifeBalancePriority: string;
  jobSecurityPriority: string;
  progressionGoal: string;
  compensationExpectation: string;
  minSalaryK: number;
  preferredWorkModes: WorkMode[];
  recommendedRoles: string[];
  consultantSummary: string;
  extractedSuperpowers?: string[];
  idealCompanyDNA?: string;
  dreamJobDefinition?: string;
  lastCompletedAt?: string;
}

export interface ConsultantChatMessage {
  id: string;
  role: 'user' | 'consultant';
  content: string;
  timestamp: string;
  extractedInsights?: string[];
}

export interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  workMode: WorkMode;
  source: JobSource;
  sourceUrl: string;
  postedAt: string;
  postedHoursAgo: number;
  salaryMinK: number;
  salaryMaxK: number;
  equity?: string;
  requiredSkills: string[];
  preferredSkills: string[];
  department: string;
  seniority: string;
  agentSummary: string;
  whyItMatches: string;
  whyCompanyLovesYou?: string;
  dreamJobAlignment?: string;
  keyResponsibilities: string[];
  companyRating?: number;
  applicantsCount?: number;
  feedBatchDate: string;
  commuteEstimate?: string;
  workLifeBalanceNote?: string;
  securityAndProgressionNote?: string;
}

export interface JobMatchBreakdown {
  overallScore: number;
  skillScore: number;
  salaryScore: number;
  workModeScore: number;
  mutualFitScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  salaryDeltaK: number;
  priorityTier: 'Priority 1 · Dream Job & Mutual Fit' | 'Priority 2 · Strong Fit' | 'Priority 3 · Exploratory';
}

export interface ScoredJobListing extends JobListing {
  match: JobMatchBreakdown;
}

export interface CandidateProfile {
  fullName: string;
  headline: string;
  yearsExperience: number;
  skills: string[];
  targetRoles: string[];
  minSalaryK: number;
  preferredWorkModes: WorkMode[];
  preferredLocations: string[];
  bioSummary: string;
  keyAchievements: string[];
  baseResumeText: string;
  baseResumeFileName: string;
  linkedInUrl: string;
  linkedInSummary: string;
  profileAnalyzedAt?: string;
  consultationBlueprint: ConsultationBlueprint;
}

export interface FilterState {
  workMode: 'All' | WorkMode;
  source: 'All' | JobSource;
  minSalaryK: number;
  searchQuery: string;
  sortBy: 'priority' | 'salary' | 'recent';
  onlyPriorityOne: boolean;
}

export interface ApplicationRecord {
  jobId: string;
  status: ApplicationStatus;
  updatedAt: string;
  appliedAt?: string;
  nextStep?: string;
  notes: string;
  tailoredResumeDraft?: string;
  coverLetterDraft?: string;
  autoTrackedByAgent?: boolean;
  autoAppliedByAgent?: boolean;
  confirmationId?: string;
  agentPipelineLog?: string[];
}

export interface CoverLetterMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: string;
  targetDoc?: 'resume' | 'cover-letter' | 'both';
  updatedDraft?: string;
}
