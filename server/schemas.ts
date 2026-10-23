import { z } from 'zod';

export const workModeSchema = z.enum(['Remote', 'Hybrid', 'On-site']);
export const jobSourceSchema = z.enum(['LinkedIn', 'Indeed', 'Glassdoor']);

export const consultationBlueprintSchema = z
  .object({
    corePassions: z.array(z.string()).optional(),
    targetLocations: z.array(z.string()).optional(),
    maxCommuteMinutes: z.number().optional(),
    workEnvironment: z.string().optional(),
    workLifeBalancePriority: z.string().optional(),
    jobSecurityPriority: z.string().optional(),
    progressionGoal: z.string().optional(),
    compensationExpectation: z.string().optional(),
    minSalaryK: z.number().optional(),
    preferredWorkModes: z.array(workModeSchema).optional(),
    recommendedRoles: z.array(z.string()).optional(),
    consultantSummary: z.string().optional(),
    extractedSuperpowers: z.array(z.string()).optional(),
    idealCompanyDNA: z.string().optional(),
    dreamJobDefinition: z.string().optional(),
  })
  .passthrough();

export const profileSchema = z
  .object({
    fullName: z.string().optional(),
    headline: z.string().optional(),
    yearsExperience: z.number().optional(),
    skills: z.array(z.string()).optional(),
    targetRoles: z.array(z.string()).optional(),
    minSalaryK: z.number().optional(),
    preferredWorkModes: z.array(workModeSchema).optional(),
    preferredLocations: z.array(z.string()).optional(),
    bioSummary: z.string().optional(),
    keyAchievements: z.array(z.string()).optional(),
    baseResumeText: z.string().optional(),
    baseResumeFileName: z.string().optional(),
    linkedInUrl: z.string().optional(),
    linkedInSummary: z.string().optional(),
    consultationBlueprint: consultationBlueprintSchema.optional(),
  })
  .passthrough();

export const jobSchema = z
  .object({
    id: z.string().optional(),
    title: z.string(),
    company: z.string(),
    location: z.string().optional(),
    workMode: workModeSchema.optional(),
    source: jobSourceSchema.optional(),
    sourceUrl: z.string().optional(),
    salaryMinK: z.number().optional(),
    salaryMaxK: z.number().optional(),
    requiredSkills: z.array(z.string()).optional(),
    preferredSkills: z.array(z.string()).optional(),
    department: z.string().optional(),
    seniority: z.string().optional(),
    agentSummary: z.string().optional(),
    whyItMatches: z.string().optional(),
    keyResponsibilities: z.array(z.string()).optional(),
  })
  .passthrough();

export const consultantMessageSchema = z.object({
  role: z.enum(['user', 'consultant', 'agent']),
  content: z.string(),
});

export const analyzeProfileBody = z.object({
  resumeText: z.string().optional(),
  resumeFileName: z.string().optional(),
  linkedInUrl: z.string().optional(),
  linkedInSummary: z.string().optional(),
  profile: profileSchema.optional(),
});

export const consultantChatBody = z.object({
  message: z.string().min(1, 'Message is required'),
  profile: profileSchema.optional(),
  currentBlueprint: consultationBlueprintSchema.optional(),
  history: z.array(consultantMessageSchema).optional(),
  memory: z.object({ semantic: z.string().max(2400).optional(), recentEpisodes: z.array(z.string().max(340)).max(3).optional(), procedural: z.array(z.string().max(300)).max(6).optional() }).optional(),
});

export const scanBody = z.object({
  profile: profileSchema.optional(),
  query: z.string().optional(),
  preferredSource: z.union([z.literal('All'), jobSourceSchema]).optional(),
  preferredWorkMode: z.union([z.literal('All'), workModeSchema]).optional(),
  fromConsultationHandoff: z.boolean().optional(),
});

export const tailorPackageBody = z.object({
  job: jobSchema,
  profile: profileSchema,
  tone: z.string().optional(),
});

export const coverLetterBody = z.object({
  job: jobSchema,
  profile: profileSchema,
  userInstruction: z.string().optional(),
  currentDraft: z.string().optional(),
  currentResumeDraft: z.string().optional(),
  targetDoc: z.enum(['resume', 'cover-letter']).optional(),
  tone: z.string().optional(),
});

export const prepareApplicationBody = z.object({
  job: jobSchema,
  profile: profileSchema.optional(),
  tailoredResume: z.string().min(20, 'Tailored resume is required'),
  coverLetter: z.string().min(20, 'Cover letter is required'),
});

export const parseResumeBody = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  dataBase64: z.string().min(1),
});

export const runtimeApiKeyBody = z.object({ apiKey: z.string().trim().max(512) });
export const runtimeProviderBody = z.object({
  provider: z.enum(['gemini', 'groq', 'openrouter']),
  apiKey: z.string().trim().max(512).optional(),
  model: z.string().trim().max(160).optional(),
  clearKey: z.boolean().optional(),
  agents: z.record(z.enum(['profileAnalysis', 'consultantChat', 'jobSearch', 'resumeTailoring', 'documentRefinement']), z.object({ provider: z.enum(['gemini', 'groq', 'openrouter']), model: z.string().trim().min(1).max(160) })).optional(),
});
