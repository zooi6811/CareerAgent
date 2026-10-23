import { createHash } from 'crypto';
import { Type, type Schema } from '@google/genai';
import type { JobListing, JobSource, WorkMode } from '../src/types/career.ts';
import {
  AgentError,
  type AgentAssignment,
  generateJson,
  groundedSearch,
  untrustedBlock,
} from './gemini.ts';

export interface SearchJobsInput {
  assignment?: AgentAssignment;
  personalityNotes?: string;
  agentInstructions?: string;
  onProgress?: (phase: string) => void;
  query?: string;
  preferredSource?: 'All' | JobSource;
  preferredWorkMode?: 'All' | WorkMode;
  fromConsultationHandoff?: boolean;
  blueprint?: {
    corePassions?: string[];
    targetLocations?: string[];
    maxCommuteMinutes?: number;
    workEnvironment?: string;
    workLifeBalancePriority?: string;
    jobSecurityPriority?: string;
    progressionGoal?: string;
    compensationExpectation?: string;
    minSalaryK?: number;
    preferredCountry?: string;
    homeLocation?: string;
    salaryCurrency?: string;
    timeZone?: string;
    preferredWorkModes?: WorkMode[];
    recommendedRoles?: string[];
    consultantSummary?: string;
  };
  skills?: string[];
}

export interface SearchJobsResult {
  scanHeadline: string;
  jobs: JobListing[];
  partial?: {
    message: string;
    text: string;
    sources: Array<{ title: string; uri: string }>;
  };
}

const BOARD_HOSTS: Array<{ source: JobSource; host: string }> = [
  { source: 'LinkedIn', host: 'linkedin.com' },
  { source: 'Indeed', host: 'indeed.com' },
  { source: 'Glassdoor', host: 'glassdoor.com' },
];

function siteFilter(preferredSource?: 'All' | JobSource): string {
  if (preferredSource === 'LinkedIn') return 'site:linkedin.com/jobs';
  if (preferredSource === 'Indeed') return 'site:indeed.com';
  if (preferredSource === 'Glassdoor') return 'site:glassdoor.com';
  return '(site:linkedin.com/jobs OR site:indeed.com OR site:glassdoor.com)';
}

function sourceFromUri(uri: string): JobSource | null {
  try {
    const host = new URL(uri).hostname.replace(/^www\./, '');
    const match = BOARD_HOSTS.find((board) => host === board.host || host.endsWith(`.${board.host}`));
    return match?.source ?? null;
  } catch {
    return null;
  }
}

function isPostingUrl(uri: string, source: JobSource): boolean {
  try {
    const url = new URL(uri);
    const path = url.pathname.toLowerCase();
    if (source === 'LinkedIn') return path.startsWith('/jobs/view/');
    if (source === 'Indeed') return path === '/viewjob' || path.startsWith('/jobs/');
    return path.includes('/job-listing/') || path.includes('/job/');
  } catch {
    return false;
  }
}

function stableJobId(company: string, title: string): string {
  return createHash('sha256')
    .update(`${company.trim().toLowerCase()}|${title.trim().toLowerCase()}`)
    .digest('hex')
    .slice(0, 16);
}

function asWorkMode(value: unknown, fallback?: WorkMode): WorkMode {
  if (value === 'Remote' || value === 'Hybrid' || value === 'On-site') {
    return value;
  }
  return fallback || 'Remote';
}

function asInt(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

interface StructuredJob {
  title?: string;
  company?: string;
  location?: string;
  workMode?: string;
  salaryMinK?: number;
  salaryMaxK?: number;
  equity?: string;
  requiredSkills?: string[];
  preferredSkills?: string[];
  department?: string;
  seniority?: string;
  agentSummary?: string;
  dreamJobAlignment?: string;
  keyResponsibilities?: string[];
  postedAt?: string;
  postedHoursAgo?: number;
  sourceIndex?: number;
}

const jobListSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    scanHeadline: { type: Type.STRING },
    jobs: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          company: { type: Type.STRING },
          location: { type: Type.STRING },
          workMode: { type: Type.STRING },
          salaryMinK: { type: Type.INTEGER },
          salaryMaxK: { type: Type.INTEGER },
          equity: { type: Type.STRING },
          requiredSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
          preferredSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
          department: { type: Type.STRING },
          seniority: { type: Type.STRING },
          agentSummary: { type: Type.STRING },
          dreamJobAlignment: { type: Type.STRING },
          keyResponsibilities: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          postedAt: { type: Type.STRING },
          postedHoursAgo: { type: Type.INTEGER },
          sourceIndex: { type: Type.INTEGER },
        },
        required: ['title', 'company', 'sourceIndex'],
      },
    },
  },
  required: ['scanHeadline', 'jobs'],
};

/**
 * Job search provider. Grounding is the current implementation; a licensed
 * aggregator (JSearch, Adzuna) can replace this function later.
 */
export async function searchJobs(
  input: SearchJobsInput
): Promise<SearchJobsResult> {
  const bp = input.blueprint || {};
  const roles =
    (Array.isArray(bp.recommendedRoles) && bp.recommendedRoles.length > 0
      ? bp.recommendedRoles
      : []
    ).filter(Boolean);
  const locations = (bp.targetLocations || []).filter(Boolean).slice(0, 6);
  const modes =
    input.preferredWorkMode && input.preferredWorkMode !== 'All'
      ? [input.preferredWorkMode]
      : bp.preferredWorkModes || [];
  const skills = (input.skills || []).filter(Boolean).slice(0, 12);
  const minSalaryK = Number(bp.minSalaryK) || 0;
  const focusQuery =
    typeof input.query === 'string' && input.query.trim().length > 0
      ? input.query.trim()
      : roles.join(', ');

  if (!focusQuery && roles.length === 0 && skills.length === 0) {
    throw new AgentError(
      'Add target roles or a search query before scanning job boards.',
      400,
      'need_blueprint'
    );
  }

  const site = siteFilter(input.preferredSource);
  const searchPrompt = [
    `Find currently open postings on ${site}. Report only found jobs; never invent facts, URLs, or commute times.`,
    'Return title, company, location, stated work mode/salary, and a short factual snippet; mark unstated details unknown.',
    untrustedBlock('criteria', JSON.stringify({
      query: focusQuery,
      locations,
      modes,
      market: bp.preferredCountry,
      home: bp.homeLocation,
      maxCommuteMinutes: bp.maxCommuteMinutes,
      currency: bp.salaryCurrency || 'USD',
      minSalaryK: minSalaryK || undefined,
      timeZone: bp.timeZone,
      skills,
      passions: (bp.corePassions || []).filter(Boolean).slice(0, 5),
      environment: bp.workEnvironment,
      workLifeBalance: bp.workLifeBalancePriority,
      jobSecurity: bp.jobSecurityPriority,
      progression: bp.progressionGoal,
    })),
    untrustedBlock('user_work_style', input.personalityNotes || ''),
    untrustedBlock('user_agent_instructions', input.agentInstructions || ''),
  ].join('\n');

  const assignment = input.assignment || { provider: 'gemini', model: 'gemini-3.8-flash' };
  input.onProgress?.(`Searching job boards with ${assignment.provider} · ${assignment.model} web search`);
  const grounded = await groundedSearch(searchPrompt, { maxOutputTokens: 1400, provider: assignment.provider, model: assignment.model });
  const boardSources = grounded.sources.filter((source) => {
    const board = sourceFromUri(source.uri);
    return board !== null && isPostingUrl(source.uri, board);
  });

  if (boardSources.length === 0 && !grounded.text.trim()) {
    throw new AgentError(
      'No matching postings found. Try broadening your search.',
      404,
      'no_results'
    );
  }

  const numberedSources = boardSources.slice(0, 12)
    .map(
      (source, index) =>
        `${index}. ${source.title} — ${source.uri}`
    )
    .join('\n');

  const structurePrompt = [
    'Extract at most 6 distinct jobs from findings. Use only supported facts; omit unknown optional fields and never infer work mode.',
    `Salary is annual ${bp.salaryCurrency || 'USD'} in thousands; use 0 when unknown. sourceIndex must identify a listed source URL proving the job exists.`,
    '',
    untrustedBlock('search_findings', grounded.text),
    '',
    'Grounding sources (use these indices):',
    numberedSources || '(none)',
  ].join('\n');

  input.onProgress?.('Structuring grounded findings and verifying source links');
  let parsed: { scanHeadline?: string; jobs?: StructuredJob[] };
  try {
    parsed = await generateJson<{
      scanHeadline?: string;
      jobs?: StructuredJob[];
    }>(structurePrompt, jobListSchema, { maxOutputTokens: 1400, timeoutMs: assignment.provider === 'groq' ? 30_000 : undefined, ...assignment });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'The result formatting step failed.';
    return {
      scanHeadline: `Partial search results · ${boardSources.length} verified job-board link${boardSources.length === 1 ? '' : 's'} found.`,
      jobs: [],
      partial: {
        message: `Search completed, but the ${assignment.provider} formatting step did not finish. The unformatted findings and verified links are shown below. ${reason}`,
        text: grounded.text.slice(0, 8_000),
        sources: boardSources.slice(0, 12),
      },
    };
  }

  const jobs: JobListing[] = [];
  const seen = new Set<string>();
  const today = new Date().toLocaleDateString();

  for (const raw of parsed.jobs || []) {
    const title = String(raw.title || '').trim();
    const company = String(raw.company || '').trim();
    if (!title || !company) continue;

    const sourceIndex = Number(raw.sourceIndex);
    const groundedSource = boardSources[sourceIndex];
    if (!groundedSource) continue;

    const source = sourceFromUri(groundedSource.uri);
    if (!source) continue;

    const id = stableJobId(company, title);
    if (seen.has(id)) continue;
    seen.add(id);

    if (raw.workMode !== 'Remote' && raw.workMode !== 'Hybrid' && raw.workMode !== 'On-site') continue;
    if (!isPostingUrl(groundedSource.uri, source)) continue;
    const workMode = asWorkMode(raw.workMode);

    jobs.push({
      id,
      title,
      company,
      location: String(raw.location || '').trim() || 'Not listed',
      workMode,
      source,
      sourceUrl: groundedSource.uri,
      postedAt: String(raw.postedAt || 'Not listed'),
      postedHoursAgo: asInt(raw.postedHoursAgo),
      salaryMinK: asInt(raw.salaryMinK),
      salaryMaxK: asInt(raw.salaryMaxK),
      salaryCurrency: bp.salaryCurrency || 'USD',
      equity: raw.equity ? String(raw.equity) : undefined,
      requiredSkills: Array.isArray(raw.requiredSkills)
        ? raw.requiredSkills.map(String).slice(0, 8)
        : [],
      preferredSkills: Array.isArray(raw.preferredSkills)
        ? raw.preferredSkills.map(String).slice(0, 6)
        : [],
      department: String(raw.department || '').trim() || 'Not listed',
      seniority: String(raw.seniority || '').trim() || 'Not listed',
      agentSummary: String(raw.agentSummary || groundedSource.title),
      whyItMatches: '',
      dreamJobAlignment: raw.dreamJobAlignment
        ? String(raw.dreamJobAlignment)
        : undefined,
      keyResponsibilities: Array.isArray(raw.keyResponsibilities)
        ? raw.keyResponsibilities.map(String)
        : [],
      feedBatchDate: input.fromConsultationHandoff
        ? `Consultant handoff · ${today}`
        : `Live scan · ${today}`,
    });
  }

  if (jobs.length === 0) {
    return {
      scanHeadline: 'Partial search results · source findings are available to review.',
      jobs: [],
      partial: {
        message: 'The search found source material, but no complete job cards could be verified. Review the raw findings and links below or broaden the search.',
        text: grounded.text.slice(0, 8_000),
        sources: boardSources.slice(0, 12),
      },
    };
  }

  return {
    scanHeadline:
      parsed.scanHeadline ||
      `Found ${jobs.length} posting${jobs.length === 1 ? '' : 's'} on LinkedIn, Indeed, and Glassdoor.`,
    jobs,
  };
}
