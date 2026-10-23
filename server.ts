import 'dotenv/config';
import express from 'express';
import type { Request } from 'express';
import { randomUUID } from 'crypto';
import rateLimit from 'express-rate-limit';
import mammoth from 'mammoth';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { Type } from '@google/genai';
import {
  AgentError,
  checkProviderConnection,
  configureProvider,
  configureAgentAssignment,
  generateJson,
  getActiveProvider,
  getAgentAssignment,
  getAgentAssignments,
  getModelName,
  getProviderModelName,
  getProviderRateLimits,
  getProviderStatuses,
  getUsageSnapshot,
  optimizeAgentAssignments,
  hasProviderApiKey,
  loadProviderApiKey,
  isAgentsStopped,
  resumeAgents,
  setRuntimeApiKey,
  sendAgentError,
  stopAgents,
  untrustedBlock,
} from './server/gemini.ts';
import { loadPersistentApiKeys, savePersistentApiKey } from './server/persistentCredentials.ts';
import { searchJobs } from './server/jobSearch.ts';
import { sharedState } from './server/sharedState.ts';
import {
  analyzeProfileBody,
  consultantChatBody,
  coverLetterBody,
  parseResumeBody,
  prepareApplicationBody,
  runtimeApiKeyBody,
  runtimeProviderBody,
  scanBody,
  tailorPackageBody,
} from './server/schemas.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MAX_RESUME_BYTES = 4 * 1024 * 1024;
type AgentTaskRecord = { id: string; agent: string; phase: string; startedAt: string; provider: string; model: string; status?: string; finishedAt?: string; durationMs?: number; httpStatus?: number; error?: string; errorCode?: string };
const activeAgentTasks = new Map<string, AgentTaskRecord>();
const recentAgentTasks: AgentTaskRecord[] = [];
const taskIds = new WeakMap<Request, string>();
const operationalRequestTimes: number[] = [];

function routeLabel(pathname: string): string {
  const names: Record<string, string> = {
    '/parse-resume': 'Resume Parser',
    '/analyze-profile': 'Career Consultant',
    '/consultant-chat': 'Career Consultant',
    '/scan': 'Job Search Agent',
    '/tailor-package': 'Resume Tailoring + Cover Letter',
    '/cover-letter': 'Document Refinement Agent',
    '/prepare-application': 'Application Prep Agent',
  };
  return names[pathname] || 'Agent';
}

function routeRole(pathname: string): keyof ReturnType<typeof getAgentAssignments> | null {
  const roles: Record<string, keyof ReturnType<typeof getAgentAssignments>> = {
    '/analyze-profile': 'profileAnalysis', '/consultant-chat': 'consultantChat',
    '/scan': 'jobSearch', '/tailor-package': 'resumeTailoring', '/cover-letter': 'documentRefinement',
  };
  return roles[pathname] || null;
}

function setAgentPhase(req: Request, phase: string): void {
  const id = taskIds.get(req);
  const task = id ? activeAgentTasks.get(id) : undefined;
  if (task) {
    task.phase = phase;
    if (/locally \(no API call\)|Validating and preparing the application package/i.test(phase)) {
      task.provider = 'local';
      task.model = 'No model API call';
    } else if (/Google Search grounding|Google Gemini/i.test(phase)) {
      task.provider = 'gemini';
      task.model = getProviderModelName('gemini');
    } else {
      const role = routeRole(new URL(req.originalUrl, 'http://localhost').pathname.replace('/api/agent', ''));
      const assignment = role ? getAgentAssignment(role) : null;
      task.provider = assignment?.provider || getActiveProvider();
      task.model = assignment?.model || getModelName();
    }
  }
}

function parseOrThrow<T>(
  schema: { safeParse: (data: unknown) => { success: true; data: T } | { success: false; error: { issues: Array<{ message: string }> } } },
  body: unknown
): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new AgentError(
      result.error.issues[0]?.message || 'Invalid request',
      400,
      'validation_error'
    );
  }
  return result.data;
}

async function startServer() {
  try {
    const savedKeys = await loadPersistentApiKeys();
    for (const provider of ['gemini', 'groq', 'openrouter'] as const) {
      if (savedKeys[provider]) loadProviderApiKey(provider, savedKeys[provider]!);
    }
  } catch {
    console.warn('Could not load the protected API-key vault. The app will start; re-save keys in Agent Controls if needed.');
  }
  const app = express();
  app.use(express.json({ limit: '8mb' }));

  const agentLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.method === 'GET' || req.path.startsWith('/control/') || req.path === '/emergency-stop' || req.path === '/resume-agents',
    handler: (_req, res) => {
      const now = new Date().toISOString();
      recentAgentTasks.unshift({ id: randomUUID(), agent: 'App request limiter', phase: 'The app blocked this request because its per-minute request limit was reached.', startedAt: now, finishedAt: now, durationMs: 0, provider: 'local', model: 'No model API call', status: 'rate limited', httpStatus: 429, error: '20 operational requests per minute reached', errorCode: 'app_rate_limited' });
      recentAgentTasks.splice(30);
      res.status(429).json({
        error: 'Rate limited, retry in a minute',
        code: 'rate_limited',
      });
    },
  });
  app.use('/api/agent', agentLimiter);

  app.use('/api/agent', (req, res, next) => {
    const exempt = req.method === 'GET' || req.path.startsWith('/control/') || req.path === '/emergency-stop' || req.path === '/resume-agents';
    if (!exempt && isAgentsStopped()) {
      res.status(423).json({ error: 'Agents are stopped. Resume them from Agent Controls to continue.', code: 'agents_stopped' });
      return;
    }
    if (req.method === 'POST' && !exempt) {
      const id = randomUUID();
      taskIds.set(req, id);
      operationalRequestTimes.push(Date.now());
      const role = routeRole(req.path);
      const assignment = role ? getAgentAssignment(role) : null;
      const localTask = req.path === '/parse-resume' || req.path === '/prepare-application';
      const task: AgentTaskRecord = { id, agent: routeLabel(req.path), phase: localTask ? 'Processing locally (no model API call)' : 'Starting', startedAt: new Date().toISOString(), provider: localTask ? 'local' : assignment?.provider || getActiveProvider(), model: localTask ? 'No model API call' : assignment?.model || getModelName() };
      activeAgentTasks.set(id, task);
      const originalJson = res.json.bind(res);
      (res as any).json = (body: unknown) => {
        if (body && typeof body === 'object' && 'partial' in body && (body as { partial?: unknown }).partial) {
          const partial = (body as { partial: { message?: unknown } }).partial;
          task.status = 'partial';
          task.phase = typeof partial.message === 'string' ? partial.message.slice(0, 280) : 'Partial results returned';
        }
        if (res.statusCode >= 400 && body && typeof body === 'object') {
          const errorBody = body as { error?: unknown; code?: unknown };
          task.error = typeof errorBody.error === 'string' ? errorBody.error.slice(0, 280) : `Request failed with HTTP ${res.statusCode}`;
          task.errorCode = typeof errorBody.code === 'string' ? errorBody.code : undefined;
        }
        return originalJson(body);
      };
      res.once('finish', () => {
        task.httpStatus = res.statusCode;
        task.finishedAt = new Date().toISOString();
        task.durationMs = Date.now() - Date.parse(task.startedAt);
        task.status ||= res.statusCode < 400 ? 'completed' : task.errorCode === 'rate_limited' ? 'rate limited' : task.errorCode === 'timeout' ? 'timed out' : task.errorCode === 'emergency_stopped' ? 'stopped' : 'failed';
        task.phase = task.error || (task.status === 'partial' ? task.phase : res.statusCode < 400 ? 'Completed successfully' : `HTTP ${res.statusCode}`);
        activeAgentTasks.delete(id);
        recentAgentTasks.unshift({ ...task });
        recentAgentTasks.splice(30);
      });
    }
    next();
  });

  app.get('/api/agent/monitor', (_req, res) => {
    const windowStart = Date.now() - 60_000;
    while (operationalRequestTimes.length && operationalRequestTimes[0] < windowStart) operationalRequestTimes.shift();
    const used = operationalRequestTimes.length;
    res.json({
      model: getModelName(),
      provider: getActiveProvider(),
      providers: getProviderStatuses(),
      apiKeyConfigured: hasProviderApiKey(getActiveProvider()),
      agentsStopped: isAgentsStopped(),
      activeTasks: [...activeAgentTasks.values()],
      recentTasks: recentAgentTasks.slice(0, 30),
      agentAssignments: getAgentAssignments(),
      usage: getUsageSnapshot(),
      providerRateLimits: getProviderRateLimits(),
      appRateLimit: { limit: 20, used, remaining: Math.max(0, 20 - used), windowSeconds: 60 },
      providerRateLimit: { state: getUsageSnapshot().rateLimited ? 'rate_limit_events' : 'no_429_seen', lastError: getUsageSnapshot().lastProviderError },
    });
  });

  app.post('/api/agent/control/key', (req, res) => {
    try {
      const { apiKey } = parseOrThrow(runtimeApiKeyBody, req.body);
      setRuntimeApiKey(apiKey);
      res.json({ configured: hasProviderApiKey(getActiveProvider()), message: apiKey ? `Key stored for ${getActiveProvider()} in server memory for this session.` : 'Runtime API key cleared.' });
    } catch (err) {
      sendAgentError(res, err);
    }
  });

  app.post('/api/agent/control/provider', async (req, res) => {
    try {
      const { provider, apiKey, model, clearKey, agents } = parseOrThrow(runtimeProviderBody, req.body);
      if ((apiKey && apiKey.trim()) || clearKey) await savePersistentApiKey(provider, apiKey || '', Boolean(clearKey));
      configureProvider(provider, apiKey, model, clearKey);
      if (agents) Object.entries(agents).forEach(([role, assignment]) => configureAgentAssignment(role as keyof ReturnType<typeof getAgentAssignments>, assignment.provider, assignment.model));
      res.json({ provider, model: getProviderModelName(provider), configured: hasProviderApiKey(provider), agents: getAgentAssignments(), message: `${provider}${apiKey?.trim() ? ' API key encrypted and saved for this Windows account' : clearKey ? ' saved API key removed' : ' settings updated'}.` });
    } catch (err) {
      sendAgentError(res, err);
    }
  });

  app.post('/api/agent/control/optimize', (_req, res) => {
    try {
      if (isAgentsStopped()) throw new AgentError('Resume agents before changing model assignments.', 423, 'agents_stopped');
      const assignments = optimizeAgentAssignments();
      for (const [role, assignment] of Object.entries(assignments)) configureAgentAssignment(role as keyof ReturnType<typeof getAgentAssignments>, assignment.provider, assignment.model);
      const searchNote = !hasProviderApiKey('gemini') && !hasProviderApiKey('groq') ? ' Job search was left unchanged because it needs Gemini grounding or Groq browser search.' : '';
      res.json({ agents: getAgentAssignments(), message: `Optimized model assignments applied for connected providers, task fit, and token efficiency.${searchNote}` });
    } catch (err) { sendAgentError(res, err); }
  });

  app.post('/api/agent/control/check', async (req, res) => {
    if (isAgentsStopped()) {
      res.status(423).json({ error: 'Agents are stopped. Resume them before checking the provider connection.', code: 'agents_stopped' });
      return;
    }
    try {
      const selectedProvider = parseOrThrow(runtimeProviderBody, { ...req.body, provider: req.body?.provider || getActiveProvider() }).provider;
      const result = await checkProviderConnection(selectedProvider);
      res.json({ ok: true, model: result.model, provider: result.provider, message: `Connected to ${result.provider} · ${result.model}. Token use is included in session totals.` });
    } catch (err) {
      sendAgentError(res, err);
    }
  });

  app.post('/api/agent/emergency-stop', (_req, res) => {
    const abortedRequests = stopAgents();
    res.json({ stopped: true, abortedRequests, message: `Emergency stop active. Aborted ${abortedRequests} in-flight model request(s). New agent work is blocked until resumed.` });
  });

  app.post('/api/agent/resume-agents', (_req, res) => {
    resumeAgents();
    res.json({ stopped: false, message: 'Agents resumed and ready.' });
  });

  app.get('/api/agent/status', (_req, res) => {
    res.json({
      model: getModelName(),
      provider: getActiveProvider(),
      liveApiConfigured: hasProviderApiKey(getActiveProvider()),
      agents: [
        'Career Consultant Agent (Resume & LinkedIn Analyzer)',
        'Job Search Agent (Grounded board search)',
        'Resume Tailoring Agent',
        'Cover Letter Agent',
        'Application Prep Agent',
      ],
    });
  });

  app.post('/api/agent/parse-resume', async (req, res) => {
    try {
      const { fileName, mimeType, dataBase64 } = parseOrThrow(
        parseResumeBody,
        req.body
      );
      setAgentPhase(req, mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf') ? 'Extracting searchable PDF text locally (no API call)' : 'Extracting text from Word document locally (no API call)');
      const buffer = Buffer.from(dataBase64, 'base64');
      if (buffer.length === 0) {
        throw new AgentError('The uploaded file was empty.', 400, 'empty_file');
      }
      if (buffer.length > MAX_RESUME_BYTES) {
        throw new AgentError(
          'Resume files must be 4MB or smaller.',
          400,
          'file_too_large'
        );
      }

      const lowerName = fileName.toLowerCase();
      const isPdf =
        mimeType === 'application/pdf' || lowerName.endsWith('.pdf');
      const isDocx =
        mimeType ===
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        lowerName.endsWith('.docx');

      if (isDocx) {
        const extracted = await mammoth.extractRawText({ buffer });
        const text = extracted.value.trim();
        if (!text) {
          throw new AgentError(
            'Could not extract text from that Word document.',
            422,
            'parse_failed'
          );
        }
        return res.json({ text, fileName, modelUsed: null });
      }

      if (isPdf) {
        const pdf = await getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
        const pages = await Promise.all(Array.from({ length: pdf.numPages }, async (_, index) => {
          const page = await pdf.getPage(index + 1);
          const content = await page.getTextContent();
          return content.items.map((item) => 'str' in item ? item.str : '').join(' ');
        }));
        const text = pages.join('\n').replace(/[ \t]+/g, ' ').trim();
        if (!text) {
          throw new AgentError('This PDF has no selectable text. Use a text-based PDF or convert the scanned pages with OCR, then upload again.', 422, 'pdf_no_selectable_text');
        }
        return res.json({ text, fileName, modelUsed: 'Local PDF text extraction (no model tokens used)' });
      }

      throw new AgentError(
        'Unsupported file type. Upload a PDF, DOCX, TXT, or Markdown file.',
        400,
        'unsupported_file_type'
      );
    } catch (err) {
      sendAgentError(res, err);
    }
  });

  app.post('/api/agent/analyze-profile', async (req, res) => {
    try {
      const body = parseOrThrow(analyzeProfileBody, req.body);
      const configuredAssignment = getAgentAssignment('profileAnalysis');
      const bp = body.profile?.consultationBlueprint || {};
      const combinedResume =
        typeof body.resumeText === 'string' && body.resumeText.trim().length > 0
          ? body.resumeText.trim()
          : body.profile?.baseResumeText || '';
      const combinedLinkedIn =
        typeof body.linkedInSummary === 'string' &&
        body.linkedInSummary.trim().length > 0
          ? body.linkedInSummary.trim()
          : body.profile?.linkedInSummary || '';

      if (!combinedResume && !combinedLinkedIn) {
        throw new AgentError(
          'Upload a resume or paste LinkedIn About and Experience text before analysis.',
          400,
          'missing_profile_text'
        );
      }

      // Source documents go through Gemini for the first structured extraction.
      // Later agents consume the compact JSON facts rather than the source text.
      const assignment = configuredAssignment.provider === 'gemini'
        ? configuredAssignment
        : { provider: 'gemini' as const, model: getProviderModelName('gemini') };
      if (!hasProviderApiKey('gemini')) {
        throw new AgentError('Resume and LinkedIn extraction sends source text to Gemini first. Add a Gemini API key in Agent Controls, or select Gemini for Resume & profile analysis.', 503, 'gemini_required_for_document_compression');
      }
      setAgentPhase(req, 'Google Gemini · Compressing resume and LinkedIn text into structured facts');

      const prompt = [
        'You are the Meridian Career Consultant Agent.',
        'Analyze only the provided resume/LinkedIn text; never invent facts. Be concise: reply ≤3 sentences, up to 6 strengths, 6 roles, and a bio ≤80 words.',
        'A LinkedIn URL alone is not a profile; only the pasted/exported text counts.',
        `User-described work style: ${body.profile?.personalityNotes || '(not provided)'}. Follow these user instructions: ${body.profile?.agentInstructions || '(none)'}`,
        `The candidate is based in ${bp.homeLocation || '(not provided)'}. Keep this distinct from preferred job locations; never infer their home from their job search preferences.`,
        `Compensation market: ${bp.preferredCountry || 'user-selected country'}; currency: ${bp.salaryCurrency || 'user-selected local currency'}; time zone: ${bp.timeZone || 'user-selected time zone'}. Any salary recommendation must be annual base pay in this currency, expressed in thousands; do not assume USD or convert currencies.`,
        '',
        untrustedBlock(
          'resume',
          `File: ${body.resumeFileName || 'Resume'}\n${combinedResume}`
        ),
        '',
        untrustedBlock(
          'linkedin_text',
          `URL (not fetched): ${body.linkedInUrl || '(none)'}\n${combinedLinkedIn}`
        ),
        '',
        'Return JSON with reply, detectedSkills, extractedSuperpowers (from the documents only),',
        'idealCompanyDNA, dreamJobDefinition, corePassions, recommendedRoles, minSalaryK (0 if unknown),',
        'keyAchievements (quoted from the documents), fullName, headline, yearsExperience, bioSummary.',
      ].join('\n');

      const parsed = await generateJson<{
        reply: string;
        detectedSkills?: string[];
        extractedSuperpowers?: string[];
        idealCompanyDNA?: string;
        dreamJobDefinition?: string;
        corePassions?: string[];
        recommendedRoles?: string[];
        minSalaryK?: number;
        keyAchievements?: string[];
        fullName?: string;
        headline?: string;
        yearsExperience?: number;
        bioSummary?: string;
      }>(prompt, {
        type: Type.OBJECT,
        properties: {
          reply: { type: Type.STRING },
          detectedSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
          extractedSuperpowers: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          idealCompanyDNA: { type: Type.STRING },
          dreamJobDefinition: { type: Type.STRING },
          corePassions: { type: Type.ARRAY, items: { type: Type.STRING } },
          recommendedRoles: { type: Type.ARRAY, items: { type: Type.STRING } },
          minSalaryK: { type: Type.INTEGER },
          keyAchievements: { type: Type.ARRAY, items: { type: Type.STRING } },
          fullName: { type: Type.STRING },
          headline: { type: Type.STRING },
          yearsExperience: { type: Type.INTEGER },
          bioSummary: { type: Type.STRING },
        },
        required: ['reply'],
      }, { maxOutputTokens: 1800, ...assignment });

      const updatedBlueprint = {
        ...bp,
        corePassions: parsed.corePassions || bp.corePassions || [],
        recommendedRoles: parsed.recommendedRoles || bp.recommendedRoles || [],
        minSalaryK:
          typeof parsed.minSalaryK === 'number'
            ? parsed.minSalaryK
            : bp.minSalaryK || 0,
        extractedSuperpowers: parsed.extractedSuperpowers || [],
        idealCompanyDNA: parsed.idealCompanyDNA || '',
        dreamJobDefinition: parsed.dreamJobDefinition || '',
        consultantSummary: parsed.dreamJobDefinition || parsed.reply,
      };

      const compressedCandidate = {
        ...body.profile,
        fullName: parsed.fullName || body.profile?.fullName,
        headline: parsed.headline || body.profile?.headline,
        yearsExperience: parsed.yearsExperience ?? body.profile?.yearsExperience,
        bioSummary: parsed.bioSummary || body.profile?.bioSummary,
        skills: parsed.detectedSkills || body.profile?.skills,
        keyAchievements: parsed.keyAchievements || body.profile?.keyAchievements,
        consultationBlueprint: updatedBlueprint,
      };
      sharedState.rememberCandidate(compressedCandidate, sharedState.candidate(compressedCandidate));

      return res.json({
        reply: parsed.reply,
        detectedSkills: parsed.detectedSkills || [],
        extractedInsights: [
          'Resume & LinkedIn text analyzed',
          `${(parsed.extractedSuperpowers || []).length} strengths extracted from the documents`,
          'Blueprint updated from provided text only',
        ],
        updatedBlueprint,
        profileUpdates: {
          fullName: parsed.fullName,
          headline: parsed.headline,
          yearsExperience: parsed.yearsExperience,
          bioSummary: parsed.bioSummary,
          keyAchievements: parsed.keyAchievements,
        },
        modelUsed: `${assignment.provider} · ${assignment.model}`,
      });
    } catch (err) {
      sendAgentError(res, err);
    }
  });

  app.post('/api/agent/consultant-chat', async (req, res) => {
    try {
      const body = parseOrThrow(consultantChatBody, req.body);
      const assignment = getAgentAssignment('consultantChat');
      setAgentPhase(req, 'Reading recent conversation and updating the career blueprint');
      const bp = body.currentBlueprint || body.profile?.consultationBlueprint || {};
      const history = (body.history || []).slice(-3);
      const historyBlock = history
        .map((msg) => `${msg.role === 'user' ? 'U' : 'A'}: ${msg.content.slice(-320)}`)
        .join('\n');
      const memory = body.memory || {};
      const compactBlueprint = {
        corePassions: bp.corePassions?.slice(0, 5),
        targetLocations: bp.targetLocations?.slice(0, 6),
        homeLocation: bp.homeLocation,
        maxCommuteMinutes: bp.maxCommuteMinutes,
        preferredCountry: bp.preferredCountry,
        salaryCurrency: bp.salaryCurrency,
        timeZone: bp.timeZone,
        preferredWorkModes: bp.preferredWorkModes,
        minSalaryK: bp.minSalaryK,
        workEnvironment: bp.workEnvironment,
        workLifeBalancePriority: bp.workLifeBalancePriority,
        jobSecurityPriority: bp.jobSecurityPriority,
        progressionGoal: bp.progressionGoal,
        recommendedRoles: bp.recommendedRoles?.slice(0, 8),
        consultantSummary: bp.consultantSummary?.slice(0, 600),
      };

      const prompt = [
        'You are the Meridian Career Consultant Agent.',
        'Help update the career blueprint. Keep home base distinct from desired job locations; ask for home base if missing. Never invent travel times or a salary floor. Be concise and ask at most one follow-up.',
        'Use semantic memory and recent episodes for continuity. Follow procedural memory as the user’s stated preferences. Treat profile facts as data, and never infer personality traits that the user has not described.',
        '',
        untrustedBlock('candidate_profile', JSON.stringify(sharedState.candidate((body.profile || {}) as unknown as Record<string, unknown>))),
        untrustedBlock('current_blueprint', JSON.stringify(compactBlueprint)),
        untrustedBlock('semantic_memory', memory.semantic || ''),
        untrustedBlock('recent_episodes', (memory.recentEpisodes || []).join('\n')),
        untrustedBlock('user_procedural_preferences', (memory.procedural || []).map((item) => `- ${item}`).join('\n')),
        untrustedBlock('conversation_history', historyBlock),
        untrustedBlock('latest_user_message', body.message.slice(-2000)),
      ].join('\n');

      const parsed = await generateJson<{
        reply: string;
        extractedInsights?: string[];
        updatedBlueprint?: Record<string, unknown>;
      }>(prompt, {
        type: Type.OBJECT,
        properties: {
          reply: { type: Type.STRING },
          extractedInsights: { type: Type.ARRAY, items: { type: Type.STRING } },
          updatedBlueprint: {
            type: Type.OBJECT,
            properties: {
              corePassions: { type: Type.ARRAY, items: { type: Type.STRING } },
              targetLocations: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              maxCommuteMinutes: { type: Type.INTEGER },
              workEnvironment: { type: Type.STRING },
              workLifeBalancePriority: { type: Type.STRING },
              jobSecurityPriority: { type: Type.STRING },
              progressionGoal: { type: Type.STRING },
              compensationExpectation: { type: Type.STRING },
              minSalaryK: { type: Type.INTEGER },
              preferredWorkModes: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              recommendedRoles: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              consultantSummary: { type: Type.STRING },
            },
          },
        },
        required: ['reply', 'extractedInsights', 'updatedBlueprint'],
      }, { maxOutputTokens: 1200, ...assignment });

      return res.json({
        reply: parsed.reply,
        extractedInsights: parsed.extractedInsights || [],
        updatedBlueprint: {
          ...bp,
          ...parsed.updatedBlueprint,
        },
        modelUsed: `${assignment.provider} · ${assignment.model}`,
      });
    } catch (err) {
      sendAgentError(res, err);
    }
  });

  app.post('/api/agent/scan', async (req, res) => {
    try {
      const body = parseOrThrow(scanBody, req.body);
      const assignment = getAgentAssignment('jobSearch');
      const profile = body.profile;
      const result = await searchJobs({
        assignment,
        query: body.query,
        preferredSource: body.preferredSource,
        preferredWorkMode: body.preferredWorkMode,
        fromConsultationHandoff: body.fromConsultationHandoff,
        blueprint: profile?.consultationBlueprint,
        skills: profile?.skills,
        personalityNotes: typeof profile?.personalityNotes === 'string' ? profile.personalityNotes : undefined,
        agentInstructions: typeof profile?.agentInstructions === 'string' ? profile.agentInstructions : undefined,
        onProgress: (phase) => setAgentPhase(req, phase),
      });
      return res.json({
        ...result,
        modelUsed: `${assignment.provider} · ${assignment.model}`,
      });
    } catch (err) {
      sendAgentError(res, err);
    }
  });

  app.post('/api/agent/tailor-package', async (req, res) => {
    try {
      const { job, profile, tone } = parseOrThrow(tailorPackageBody, req.body);
      const assignment = getAgentAssignment('resumeTailoring');
      setAgentPhase(req, 'Tailoring resume and drafting cover letter');
      const selectedTone = tone || 'Executive & Impact-Driven';
      const bp = profile.consultationBlueprint || {};

      let compressedTaskContext: { candidate: unknown; job: unknown } | null = null;
      if (assignment.provider === 'groq') {
        if (!hasProviderApiKey('gemini')) {
          throw new AgentError('Groq document tailoring only accepts compressed facts. Add a Gemini key so the resume and job description can be summarized before they reach Groq.', 503, 'gemini_required_for_document_compression');
        }
        setAgentPhase(req, 'Google Gemini · Compressing resume and job requirements into structured state');
        const compressed = await generateJson<{ candidate: unknown; job: unknown }>([
          'Create compact JSON facts for downstream tailoring. Preserve only evidence found in source text. Never invent credentials, metrics, dates, or requirements.',
          'candidate must include name, headline, skills, experience, concise bio, and up to 10 evidence-backed achievements.',
          'job must include title, company, location, work mode, required skills, preferred skills, responsibilities, and a concise description of requirements.',
          untrustedBlock('resume_source', `${profile.baseResumeFileName || 'Resume'}\n${profile.baseResumeText || ''}`),
          untrustedBlock('job_source', JSON.stringify({ ...job, agentSummary: job.agentSummary?.slice(0, 6000) })),
        ].join('\n'), {
          type: Type.OBJECT,
          properties: {
            candidate: { type: Type.OBJECT },
            job: { type: Type.OBJECT },
          },
          required: ['candidate', 'job'],
        }, { maxOutputTokens: 1800, provider: 'gemini', model: getProviderModelName('gemini') });
        compressedTaskContext = {
          ...compressed,
          candidate: {
            ...(typeof compressed.candidate === 'object' && compressed.candidate ? compressed.candidate as Record<string, unknown> : {}),
            userWorkStyle: typeof profile.personalityNotes === 'string' ? profile.personalityNotes.slice(0, 1000) : '',
            userInstructions: typeof profile.agentInstructions === 'string' ? profile.agentInstructions.slice(0, 1000) : '',
            careerPreferences: sharedState.candidate(profile as unknown as Record<string, unknown>).careerPreferences,
          },
        };
      }

      const prompt = [
        'Tailor the resume and cover letter using only candidate evidence and job facts. Never invent credentials, metrics, or insider claims; note unsupported requirements briefly in fitRationale. Respect the user-provided work style and agent instructions below.',
        `Tone: ${selectedTone}`,
        '',
        untrustedBlock('job', JSON.stringify(compressedTaskContext?.job ?? { title: job.title, company: job.company, location: job.location, workMode: job.workMode, requiredSkills: job.requiredSkills, preferredSkills: job.preferredSkills, keyResponsibilities: job.keyResponsibilities, description: job.agentSummary })),
        untrustedBlock(
          'candidate',
          JSON.stringify(compressedTaskContext?.candidate ?? {
            fullName: profile.fullName,
            headline: profile.headline,
            yearsExperience: profile.yearsExperience,
            skills: profile.skills,
            keyAchievements: profile.keyAchievements,
            bioSummary: profile.bioSummary,
            consultationSummary: bp.consultantSummary,
            personalityNotes: profile.personalityNotes,
            agentInstructions: profile.agentInstructions,
          })
        ),
        ...(assignment.provider === 'groq' ? [] : [untrustedBlock('base_resume', `${profile.baseResumeFileName || 'Resume'}\n${profile.baseResumeText || ''}`)]),
        '',
        'Return the full tailoredResume and coverLetter. Keep agentSummary and UI-only fitRationale to ≤50 words each.',
      ].join('\n');

      const parsed = await generateJson<{
        tailoredResume: string;
        coverLetter: string;
        agentSummary: string;
        fitRationale?: string;
      }>(prompt, {
        type: Type.OBJECT,
        properties: {
          tailoredResume: { type: Type.STRING },
          coverLetter: { type: Type.STRING },
          agentSummary: { type: Type.STRING },
          fitRationale: { type: Type.STRING },
        },
        required: ['tailoredResume', 'coverLetter', 'agentSummary'],
      }, { maxOutputTokens: 7000, ...assignment });

      return res.json({
        tailoredResume: parsed.tailoredResume,
        coverLetter: parsed.coverLetter,
        agentSummary: parsed.agentSummary,
        fitRationale: parsed.fitRationale || '',
        modelUsed: `${assignment.provider} · ${assignment.model}`,
      });
    } catch (err) {
      sendAgentError(res, err);
    }
  });

  app.post('/api/agent/cover-letter', async (req, res) => {
    try {
      const body = parseOrThrow(coverLetterBody, req.body);
      const assignment = getAgentAssignment('documentRefinement');
      setAgentPhase(req, 'Refining the selected document');
      const docType = body.targetDoc === 'resume' ? 'resume' : 'cover-letter';
      const instruction =
        body.userInstruction?.trim() ||
        `Refine the tailored ${docType} for ${body.job.company}.`;
      const selectedTone = body.tone || 'Executive & Impact-Driven';
      let draftForModel = String(docType === 'resume' ? body.currentResumeDraft : body.currentDraft || '');
      if (assignment.provider === 'groq') {
        if (!hasProviderApiKey('gemini')) {
          throw new AgentError('Groq document refinement only accepts compressed facts. Add a Gemini key so the draft can be summarized before it reaches Groq.', 503, 'gemini_required_for_document_compression');
        }
        setAgentPhase(req, 'Google Gemini · Compressing the draft into structured facts');
        const compactDraft = await generateJson<{ documentFacts: string; sections: string[] }>([
          'Convert this document into compact JSON for a downstream editor. Preserve all factual claims, names, dates, metrics, skills, and section order exactly where possible. Do not add or rewrite claims.',
          `Document type: ${docType}. Summarize the content in documentFacts (maximum 6000 characters) and list its sections.`,
          untrustedBlock('source_document', draftForModel),
        ].join('\n'), {
          type: Type.OBJECT,
          properties: { documentFacts: { type: Type.STRING }, sections: { type: Type.ARRAY, items: { type: Type.STRING } } },
          required: ['documentFacts', 'sections'],
        }, { maxOutputTokens: 1800, provider: 'gemini', model: getProviderModelName('gemini') });
        draftForModel = JSON.stringify(compactDraft);
      }

      const prompt = [
        `You are Meridian's ${
          docType === 'resume' ? 'Resume Tailoring Agent' : 'Cover Letter Agent'
        }.`,
        'Edit only from the current draft and user instruction. Never invent achievements or insider claims. Respect the user-provided work style and agent instructions below.',
        `Tone: ${selectedTone}`,
        '',
        untrustedBlock('job', JSON.stringify({ title: body.job.title, company: body.job.company, location: body.job.location, workMode: body.job.workMode, requiredSkills: body.job.requiredSkills, keyResponsibilities: body.job.keyResponsibilities })),
        untrustedBlock('candidate_name', body.profile.fullName || ''),
        untrustedBlock('user_work_style_and_instructions', `${body.profile.personalityNotes || ''}\n${body.profile.agentInstructions || ''}`),
        untrustedBlock(
          'current_draft',
          draftForModel
        ),
        untrustedBlock('user_instruction', instruction),
        '',
        'Return reply (1-2 sentences) and updatedDraft (full document).',
      ].join('\n');

      const parsed = await generateJson<{
        reply: string;
        updatedDraft: string;
      }>(prompt, {
        type: Type.OBJECT,
        properties: {
          reply: { type: Type.STRING },
          updatedDraft: { type: Type.STRING },
        },
        required: ['reply', 'updatedDraft'],
      }, { maxOutputTokens: 5000, ...assignment });

      return res.json({
        reply: parsed.reply,
        updatedDraft: parsed.updatedDraft,
        targetDoc: docType,
        modelUsed: `${assignment.provider} · ${assignment.model}`,
      });
    } catch (err) {
      sendAgentError(res, err);
    }
  });

  app.post('/api/agent/prepare-application', async (req, res) => {
    try {
      const { job, tailoredResume, coverLetter } = parseOrThrow(
        prepareApplicationBody,
        req.body
      );
      setAgentPhase(req, 'Validating and preparing the application package');
      if (!job.sourceUrl) {
        throw new AgentError(
          'This listing has no verified application URL.',
          400,
          'missing_source_url'
        );
      }
      let sourceHost: string;
      try {
        sourceHost = new URL(job.sourceUrl).hostname.replace(/^www\./, '').toLowerCase();
      } catch {
        throw new AgentError('This listing has an invalid application URL.', 400, 'invalid_source_url');
      }
      const validHost =
        (job.source === 'LinkedIn' && (sourceHost === 'linkedin.com' || sourceHost.endsWith('.linkedin.com'))) ||
        (job.source === 'Indeed' && (sourceHost === 'indeed.com' || sourceHost.endsWith('.indeed.com'))) ||
        (job.source === 'Glassdoor' && (sourceHost === 'glassdoor.com' || sourceHost.endsWith('.glassdoor.com')));
      if (!validHost) {
        throw new AgentError('Application URL must point to the verified job board.', 400, 'invalid_source_url');
      }
      const timestamp = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      const checklist = [
        `[${timestamp}] Tailored resume ready (${tailoredResume.split(/\s+/).filter(Boolean).length} words)`,
        `[${timestamp}] Cover letter ready (${coverLetter.split(/\s+/).filter(Boolean).length} words)`,
        `[${timestamp}] Open the posting on ${job.source || 'the job board'} and submit it yourself`,
        `[${timestamp}] Return here and click "I submitted this" only after you actually apply`,
      ];
      return res.json({
        ready: true,
        sourceUrl: job.sourceUrl,
        source: job.source,
        resume: tailoredResume,
        coverLetter,
        checklist,
        message: `Package ready for ${job.title} at ${job.company}. Nothing was submitted.`,
      });
    } catch (err) {
      sendAgentError(res, err);
    }
  });

  app.use('/api', (err: unknown, _req: Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) return next(err);
    const error = err as { status?: number; statusCode?: number; type?: string; message?: string };
    const status = error.status || error.statusCode || 500;
    const code = error.type === 'entity.parse.failed' ? 'invalid_json' : status === 413 ? 'payload_too_large' : 'request_failed';
    res.status(status).json({ error: status < 500 ? error.message || 'Invalid request.' : 'The app server could not complete the request.', code });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `Meridian Career Agent server running on http://localhost:${PORT}`
    );
  });
}

startServer();
