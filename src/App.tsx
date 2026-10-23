/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AgentMemory,
  ApplicationRecord,
  ApplicationStatus,
  CandidateProfile,
  ConsultantChatMessage,
  ConsultationBlueprint,
  CoverLetterMessage,
  FilterState,
  JobListing,
  ScoredJobListing,
} from './types/career';
import {
  DEMO_APPLICATIONS,
  DEMO_CANDIDATE_PROFILE,
  DEMO_CONSULTANT_MESSAGES,
  DEMO_JOB_FEED,
  EMPTY_APPLICATIONS,
  EMPTY_BLUEPRINT,
  EMPTY_CANDIDATE_PROFILE,
  EMPTY_CONSULTANT_MESSAGES,
  EMPTY_JOB_FEED,
} from './data/seedJobs';
import {
  applyBlueprintToProfile,
  calculateJobMatch,
  computePipelineMetrics,
  generateTailoredResumeText,
  prioritizeAndFilterJobs,
} from './utils/jobScoring';
import {
  AgentClientError,
  agentFetch,
  defaultNextStep,
  formatAgentError,
  formatAppliedAt,
  mergeJobFeeds,
} from './utils/agentApi';
import { ActiveTab, TopBar } from './components/TopBar';
import { CareerHubView } from './components/CareerHubView';
import { DailyFeedView } from './components/DailyFeedView';
import { ApplicationTrackerView } from './components/ApplicationTrackerView';
import { CoverLetterStudio } from './components/CoverLetterStudio';
import { PreferencesView } from './components/PreferencesView';
import { AgentControlsPanel, AgentMonitorState } from './components/AgentControlsPanel';
import { browserLocaleDefaults } from './utils/localePreferences';
import { EMPTY_AGENT_MEMORY, memoryForAgent, reflectAgentMemory } from './utils/agentMemory';

const STORAGE_KEYS = {
  JOBS: 'meridian_career_jobs_v5',
  PROFILE: 'meridian_career_profile_v5',
  APPLICATIONS: 'meridian_career_applications_v5',
  CONSULTANT: 'meridian_career_consultant_v5',
  MEMORY: 'meridian_agent_memory_v1',
  SESSION: 'meridian_session_memory_v1',
  SCAN_HEADLINE: 'meridian_last_scan_headline_v1',
  SCAN_PARTIAL: 'meridian_last_scan_partial_v1',
  CHAT_HISTORY: 'meridian_job_chat_history_v1',
};

function readStorage<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return fallback;
    return JSON.parse(saved) as T;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('feed');
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [agentMonitor, setAgentMonitor] = useState<AgentMonitorState | null>(null);
  const [agentControlsOpen, setAgentControlsOpen] = useState(false);

  const [jobs, setJobs] = useState<JobListing[]>(() =>
    readStorage(STORAGE_KEYS.JOBS, EMPTY_JOB_FEED)
  );
  const [profile, setProfile] = useState<CandidateProfile>(() => {
    const saved = readStorage(STORAGE_KEYS.PROFILE, EMPTY_CANDIDATE_PROFILE);
    const detected = browserLocaleDefaults();
    // The older app stored every salary as USD without recording a currency.
    const defaults = !saved.salaryCurrency && (saved.minSalaryK > 0 || saved.consultationBlueprint?.minSalaryK > 0)
      ? { preferredCountry: 'United States', salaryCurrency: 'USD', timeZone: 'America/New_York' }
      : detected;
    return {
      ...EMPTY_CANDIDATE_PROFILE,
      ...defaults,
      ...saved,
      consultationBlueprint: {
        ...EMPTY_BLUEPRINT,
        ...defaults,
        ...saved.consultationBlueprint,
      },
    };
  });
  const [applications, setApplications] = useState<
    Record<string, ApplicationRecord>
  >(() => readStorage(STORAGE_KEYS.APPLICATIONS, EMPTY_APPLICATIONS));
  const [consultantMessages, setConsultantMessages] = useState<
    ConsultantChatMessage[]
  >(() => readStorage(STORAGE_KEYS.CONSULTANT, EMPTY_CONSULTANT_MESSAGES));
  const [agentMemory, setAgentMemory] = useState<AgentMemory>(() => readStorage(STORAGE_KEYS.MEMORY, EMPTY_AGENT_MEMORY));
  const [sessionMemory, setSessionMemory] = useState<{ lastOpenedAt?: string; previousOpenedAt?: string; lastSummary: string }>(() => readStorage(STORAGE_KEYS.SESSION, { lastSummary: '' }));

  const [isConsulting, setIsConsulting] = useState(false);
  const [isAnalyzingProfile, setIsAnalyzingProfile] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    workMode: 'All',
    source: 'All',
    minSalaryK: 0,
    searchQuery: '',
    sortBy: 'priority',
    onlyPriorityOne: false,
  });
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanHeadline, setLastScanHeadline] = useState(() => readStorage(STORAGE_KEYS.SCAN_HEADLINE, 'No scan yet. Upload a resume, finish the consultation, then search LinkedIn, Indeed, and Glassdoor.'));
  const [lastScanPartial, setLastScanPartial] = useState<{ message: string; text: string; sources: Array<{ title: string; uri: string }> } | null>(() => readStorage(STORAGE_KEYS.SCAN_PARTIAL, null));
  const [isGeneratingLetter, setIsGeneratingLetter] = useState(false);
  const [chatHistoryByJob, setChatHistoryByJob] = useState<
    Record<string, CoverLetterMessage[]>
  >(() => readStorage(STORAGE_KEYS.CHAT_HISTORY, {}));

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify(jobs));
    } catch {
      /* ignore quota */
    }
  }, [jobs]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
    } catch {
      /* ignore */
    }
  }, [profile]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.APPLICATIONS,
        JSON.stringify(applications)
      );
    } catch {
      /* ignore */
    }
  }, [applications]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.CONSULTANT,
        JSON.stringify(consultantMessages)
      );
    } catch {
      /* ignore */
    }
  }, [consultantMessages]);

  useEffect(() => { try { localStorage.setItem(STORAGE_KEYS.MEMORY, JSON.stringify(agentMemory)); } catch { /* ignore quota */ } }, [agentMemory]);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sessionMemory)); } catch { /* ignore quota */ } }, [sessionMemory]);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEYS.SCAN_HEADLINE, JSON.stringify(lastScanHeadline)); } catch { /* ignore quota */ } }, [lastScanHeadline]);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEYS.SCAN_PARTIAL, JSON.stringify(lastScanPartial)); } catch { /* ignore quota */ } }, [lastScanPartial]);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEYS.CHAT_HISTORY, JSON.stringify(chatHistoryByJob)); } catch { /* ignore quota */ } }, [chatHistoryByJob]);
  useEffect(() => { setAgentMemory((previous) => reflectAgentMemory(profile, previous)); }, [profile]);
  useEffect(() => { setSessionMemory((previous) => ({ ...previous, previousOpenedAt: previous.lastOpenedAt, lastOpenedAt: new Date().toISOString() })); }, []);

  const recordSessionReflection = (summary: string) => {
    setSessionMemory((previous) => ({ ...previous, lastSummary: summary.slice(0, 280) }));
  };

  const saveAllDataNow = () => {
    try {
      localStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify(jobs));
      localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
      localStorage.setItem(STORAGE_KEYS.APPLICATIONS, JSON.stringify(applications));
      localStorage.setItem(STORAGE_KEYS.CONSULTANT, JSON.stringify(consultantMessages));
      localStorage.setItem(STORAGE_KEYS.MEMORY, JSON.stringify(agentMemory));
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sessionMemory));
      localStorage.setItem(STORAGE_KEYS.SCAN_HEADLINE, JSON.stringify(lastScanHeadline));
      localStorage.setItem(STORAGE_KEYS.CHAT_HISTORY, JSON.stringify(chatHistoryByJob));
    } catch { setGlobalError('Could not save all data to this browser. Check available storage.'); }
  };

  const reportError = useCallback((err: unknown) => {
    setGlobalError(formatAgentError(err));
  }, []);

  const refreshAgentMonitor = useCallback(async () => {
    const response = await fetch('/api/agent/monitor');
    if (!response.ok) throw new Error('Could not read agent status.');
    setAgentMonitor(await response.json() as AgentMonitorState);
  }, []);

  useEffect(() => {
    let disposed = false;
    const refresh = async () => {
      try {
        const response = await fetch('/api/agent/monitor');
        if (response.ok && !disposed) setAgentMonitor(await response.json() as AgentMonitorState);
      } catch { /* keep the last known status while the server is unavailable */ }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 2000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, []);

  const handleToggleEmergencyStop = async () => {
    try {
      const path = agentMonitor?.agentsStopped ? '/api/agent/resume-agents' : '/api/agent/emergency-stop';
      const response = await fetch(path, { method: 'POST' });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Could not update agent state.');
      await refreshAgentMonitor();
    } catch (error) { reportError(error); }
  };

  const allScoredJobs: ScoredJobListing[] = useMemo(() => {
    return jobs
      .map((job) => ({
        ...job,
        match: calculateJobMatch(job, profile),
      }))
      .sort((a, b) => b.match.overallScore - a.match.overallScore);
  }, [jobs, profile]);

  const filteredJobs: ScoredJobListing[] = useMemo(() => {
    return prioritizeAndFilterJobs(jobs, profile, filters);
  }, [jobs, profile, filters]);

  const selectedJob: ScoredJobListing | undefined = useMemo(() => {
    return (
      allScoredJobs.find((j) => j.id === selectedJobId) ||
      filteredJobs[0] ||
      allScoredJobs[0]
    );
  }, [allScoredJobs, filteredJobs, selectedJobId]);

  const pipelineMetrics = useMemo(
    () => computePipelineMetrics(applications),
    [applications]
  );

  const handleSendConsultantMessage = async (userText: string) => {
    setIsConsulting(true);
    const userMsg: ConsultantChatMessage = {
      id: `consult-user-${Date.now()}`,
      role: 'user',
      content: userText,
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
    const historyForRequest = [...consultantMessages, userMsg].slice(-3);
    setConsultantMessages((prev) => [...prev, userMsg]);

    try {
      const data = await agentFetch<{
        reply: string;
        extractedInsights?: string[];
        updatedBlueprint?: ConsultationBlueprint;
      }>('/api/agent/consultant-chat', {
        message: userText,
        profile: { ...profile, baseResumeText: '', linkedInSummary: '' },
        currentBlueprint: profile.consultationBlueprint,
        memory: memoryForAgent(agentMemory),
        history: historyForRequest.map((msg) => ({
          role: msg.role,
          content: msg.content.slice(-320),
        })),
      });
      if (data.updatedBlueprint) {
        const nextProfile = applyBlueprintToProfile(profile, data.updatedBlueprint as ConsultationBlueprint);
        setProfile(nextProfile);
        setAgentMemory((previous) => reflectAgentMemory(nextProfile, previous, `Career consultation: ${userText.slice(0, 130)} — ${data.reply.slice(0, 130)}`, userText));
      } else setAgentMemory((previous) => reflectAgentMemory(profile, previous, `Career consultation: ${userText.slice(0, 130)} — ${data.reply.slice(0, 130)}`, userText));
      recordSessionReflection(`Career consultation updated: ${userText.slice(0, 100)}`);
      setConsultantMessages((prev) => [
        ...prev,
        {
          id: `consult-agent-${Date.now()}`,
          role: 'consultant',
          content: data.reply,
          timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          extractedInsights: data.extractedInsights,
        },
      ]);
    } catch (err) {
      reportError(err);
      setConsultantMessages((prev) => [
        ...prev,
        {
          id: `consult-error-${Date.now()}`,
          role: 'consultant',
          content: formatAgentError(err),
          timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
      ]);
    } finally {
      setIsConsulting(false);
    }
  };

  const handleAnalyzeResumeAndLinkedIn = async (
    resumeText: string,
    resumeFileName: string,
    linkedInUrl: string,
    linkedInSummary: string,
    autoLaunchJobSearch = false
  ): Promise<boolean> => {
    setIsAnalyzingProfile(true);
    try {
      const data = await agentFetch<{
        reply: string;
        detectedSkills?: string[];
        extractedInsights?: string[];
        updatedBlueprint?: ConsultationBlueprint;
        profileUpdates?: Partial<CandidateProfile> & {
          keyAchievements?: string[];
        };
      }>('/api/agent/analyze-profile', {
        resumeText,
        resumeFileName,
        linkedInUrl,
        linkedInSummary,
        profile,
      });
      const nextBlueprint: ConsultationBlueprint =
        data.updatedBlueprint || profile.consultationBlueprint;
      const mergedSkills = Array.from(
        new Set([...(data.detectedSkills || []), ...profile.skills])
      );
      const updates = data.profileUpdates || {};
      const nextProfile = applyBlueprintToProfile(
        {
          ...profile,
          fullName: updates.fullName || profile.fullName,
          headline: updates.headline || profile.headline,
          yearsExperience: updates.yearsExperience || profile.yearsExperience,
          bioSummary: updates.bioSummary || profile.bioSummary,
          keyAchievements:
            updates.keyAchievements && updates.keyAchievements.length > 0
              ? updates.keyAchievements
              : profile.keyAchievements,
          baseResumeText: resumeText,
          baseResumeFileName: resumeFileName,
          linkedInUrl,
          linkedInSummary,
          skills: mergedSkills,
          profileAnalyzedAt: new Date().toISOString(),
        },
        nextBlueprint
      );
      setProfile(nextProfile);
      setAgentMemory((previous) => reflectAgentMemory(nextProfile, previous, `Resume and LinkedIn analysis completed for ${resumeFileName || 'resume'}; ${mergedSkills.length} skills are in the profile.`));
      recordSessionReflection(`Resume analyzed; ${mergedSkills.length} skills and career preferences updated.`);
      setConsultantMessages((prev) => [
        ...prev,
        {
          id: `consult-analyze-${Date.now()}`,
          role: 'consultant',
          content: data.reply,
          timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          extractedInsights: data.extractedInsights,
        },
      ]);
      if (autoLaunchJobSearch) {
        await handleRunAgentScan(
          nextBlueprint.recommendedRoles[0] || '',
          nextProfile,
          true
        );
      }
      return true;
    } catch (err) {
      reportError(err);
      return false;
    } finally {
      setIsAnalyzingProfile(false);
    }
  };

  const handleEndConsultationAndLaunchSearch = async (
    finalBlueprint: ConsultationBlueprint
  ) => {
    const updatedProfile = applyBlueprintToProfile(profile, finalBlueprint);
    setProfile(updatedProfile);
    await handleRunAgentScan(
      finalBlueprint.recommendedRoles[0] || '',
      updatedProfile,
      true
    );
  };

  const handleUpdateBlueprint = (updatedBlueprint: ConsultationBlueprint) => {
    setProfile((prev) => applyBlueprintToProfile(prev, updatedBlueprint));
  };

  const handleUploadBaseResume = (fileName: string, content: string) => {
    setProfile((prev) => ({
      ...prev,
      baseResumeFileName: fileName,
      baseResumeText: content,
    }));
  };

  const handleUpdateApplicationStatus = (
    jobId: string,
    status: ApplicationStatus
  ) => {
    const jobTitle = jobs.find((job) => job.id === jobId)?.title || 'Job application';
    const eventSummary = `${jobTitle} marked ${status}.`;
    setAgentMemory((previous) => reflectAgentMemory(profile, previous, eventSummary));
    recordSessionReflection(eventSummary);
    setApplications((prev) => {
      const existing = prev[jobId];
      if (status === 'Untracked') {
        const next = { ...prev };
        delete next[jobId];
        return next;
      }
      const keepNextStep = status === existing?.status && Boolean(existing?.nextStepCustomized);
      return {
        ...prev,
        [jobId]: {
          jobId,
          status,
          updatedAt: new Date().toISOString(),
          appliedAt:
            status === 'Applied'
              ? existing?.appliedAt || formatAppliedAt()
              : existing?.appliedAt,
          nextStep: keepNextStep
            ? existing?.nextStep
            : defaultNextStep(status),
          nextStepCustomized: keepNextStep,
          notes: existing?.notes || `Tracked via Meridian Career Agent (${status}).`,
          tailoredResumeDraft: existing?.tailoredResumeDraft,
          coverLetterDraft: existing?.coverLetterDraft,
          fitRationale: existing?.fitRationale,
          autoTrackedByAgent: existing?.autoTrackedByAgent ?? false,
          agentPipelineLog: existing?.agentPipelineLog,
        },
      };
    });
  };

  const handleUpdateApplicationNotes = (
    jobId: string,
    notes: string,
    nextStep: string
  ) => {
    setApplications((prev) => {
      const existing = prev[jobId];
      if (!existing) return prev;
      return {
        ...prev,
        [jobId]: {
          ...existing,
          notes,
          nextStep,
          nextStepCustomized: true,
          updatedAt: new Date().toISOString(),
        },
      };
    });
  };

  const handleSavePackageAndStatus = (
    jobId: string,
    tailoredResume: string,
    coverLetter: string,
    status?: ApplicationStatus,
    extras?: { fitRationale?: string; agentPipelineLog?: string[] }
  ) => {
    setApplications((prev) => {
      const existing = prev[jobId];
      const nextStatus = status || existing?.status || 'Saved';
      const keepNextStep = nextStatus === existing?.status && Boolean(existing?.nextStepCustomized);
      return {
        ...prev,
        [jobId]: {
          jobId,
          status: nextStatus,
          updatedAt: new Date().toISOString(),
          appliedAt:
            nextStatus === 'Applied'
              ? existing?.appliedAt || formatAppliedAt()
              : existing?.appliedAt,
          nextStep: keepNextStep
            ? existing?.nextStep
            : defaultNextStep(nextStatus),
          nextStepCustomized: keepNextStep,
          notes:
            existing?.notes ||
            'Tailored resume and cover letter prepared in Application Studio.',
          tailoredResumeDraft: tailoredResume,
          coverLetterDraft: coverLetter,
          fitRationale: extras?.fitRationale ?? existing?.fitRationale,
          autoTrackedByAgent: existing?.autoTrackedByAgent ?? false,
          agentPipelineLog:
            extras?.agentPipelineLog ?? existing?.agentPipelineLog,
        },
      };
    });
  };

  const handleMarkSubmitted = (jobId: string) => {
    handleUpdateApplicationStatus(jobId, 'Applied');
  };

  const handleAutoTrackTopMatches = (): number => {
    let newlyAdded = 0;
    const nextApps = { ...applications };
    for (const job of allScoredJobs) {
      if (job.match.overallScore >= 85) {
        const existing = nextApps[job.id];
        if (!existing || existing.status === 'Untracked') {
          newlyAdded++;
          nextApps[job.id] = {
            jobId: job.id,
            status: 'Saved',
            updatedAt: new Date().toISOString(),
            nextStep: defaultNextStep('Saved'),
            notes: `Queued from a ${job.match.overallScore}% match on ${job.source}.`,
            tailoredResumeDraft: generateTailoredResumeText(job, profile),
            autoTrackedByAgent: true,
          };
        }
      }
    }
    if (newlyAdded > 0) setApplications(nextApps);
    return newlyAdded;
  };

  const handleRunAgentScan = async (
    customQuery?: string,
    overrideProfile?: CandidateProfile,
    fromConsultationHandoff = false
  ) => {
    if (isScanning) return;
    setIsScanning(true);
    setLastScanPartial(null);
    const activeProfile = overrideProfile || profile;
    try {
      const data = await agentFetch<{
        jobs: JobListing[];
        scanHeadline?: string;
        partial?: { message: string; text: string; sources: Array<{ title: string; uri: string }> };
      }>('/api/agent/scan', {
        profile: activeProfile,
        query: customQuery || '',
        preferredSource: filters.source,
        preferredWorkMode: filters.workMode,
        fromConsultationHandoff,
      });
      if (Array.isArray(data.jobs) && data.jobs.length > 0) {
        setLastScanPartial(null);
        setJobs((prev) => mergeJobFeeds(data.jobs, prev, 100));
        setSelectedJobId(data.jobs[0].id);
        if (data.scanHeadline) setLastScanHeadline(data.scanHeadline);
        setAgentMemory((previous) => reflectAgentMemory(activeProfile, previous, `Job search found ${data.jobs.length} postings${data.scanHeadline ? `: ${data.scanHeadline}` : ''}.`));
        recordSessionReflection(`Job search found ${data.jobs.length} postings${data.scanHeadline ? ` — ${data.scanHeadline}` : ''}.`);
        setActiveTab('feed');
      } else if (data.partial) {
        setLastScanPartial(data.partial);
        setLastScanHeadline(data.scanHeadline || 'Partial search results are available below.');
        setActiveTab('feed');
      }
    } catch (err) {
      reportError(err);
      if (err instanceof AgentClientError && err.code === 'no_results') {
        setLastScanHeadline(
          'No verified postings found. Broaden roles, locations, or work mode and try again.'
        );
        setActiveTab('feed');
      }
    } finally {
      setIsScanning(false);
    }
  };

  const handleTailorBothDocuments = async (
    job: ScoredJobListing,
    tone: string
  ) => {
    setIsGeneratingLetter(true);
    try {
      const data = await agentFetch<{
        tailoredResume: string;
        coverLetter: string;
        agentSummary?: string;
        fitRationale?: string;
      }>('/api/agent/tailor-package', { job, profile, tone });
      setChatHistoryByJob((prev) => ({
        ...prev,
        [job.id]: [
          ...(prev[job.id] || []),
          {
            id: `agent-pkg-${Date.now()}`,
            role: 'agent',
            content:
              data.agentSummary ||
              `Tailored resume and cover letter drafted for ${job.company} from your uploaded resume.`,
            timestamp: new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
          },
        ],
      }));
      handleSavePackageAndStatus(
        job.id,
        data.tailoredResume,
        data.coverLetter,
        applications[job.id]?.status || 'Saved',
        { fitRationale: data.fitRationale }
      );
      return {
        tailoredResume: data.tailoredResume,
        coverLetter: data.coverLetter,
        agentSummary: data.agentSummary || '',
        fitRationale: data.fitRationale || '',
      };
    } catch (err) {
      reportError(err);
    } finally {
      setIsGeneratingLetter(false);
    }
    return null;
  };

  const handleSendCoverLetterPrompt = async (
    job: ScoredJobListing,
    instruction: string,
    tone = 'Executive & Impact-Driven',
    currentCoverLetter = '',
    currentResume = '',
    targetDoc: 'resume' | 'cover-letter' = 'cover-letter'
  ): Promise<{
    updatedDraft?: string;
    targetDoc?: 'resume' | 'cover-letter';
  }> => {
    setIsGeneratingLetter(true);
    const userMsg: CoverLetterMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: instruction,
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      targetDoc,
    };
    setChatHistoryByJob((prev) => ({
      ...prev,
      [job.id]: [...(prev[job.id] || []), userMsg],
    }));
    try {
      const data = await agentFetch<{
        reply?: string;
        updatedDraft?: string;
        targetDoc?: 'resume' | 'cover-letter';
      }>('/api/agent/cover-letter', {
        job,
        profile,
        userInstruction: instruction,
        currentDraft:
          currentCoverLetter || applications[job.id]?.coverLetterDraft || '',
        currentResumeDraft:
          currentResume ||
          applications[job.id]?.tailoredResumeDraft ||
          generateTailoredResumeText(job, profile),
        targetDoc,
        tone,
      });
      setChatHistoryByJob((prev) => ({
        ...prev,
        [job.id]: [
          ...(prev[job.id] || []),
          {
            id: `agent-${Date.now()}`,
            role: 'agent',
            content:
              data.reply ||
              `Updated tailored ${targetDoc} for ${job.title} at ${job.company}.`,
            timestamp: new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
            targetDoc: data.targetDoc || targetDoc,
            updatedDraft: data.updatedDraft,
          },
        ],
      }));
      if (data.updatedDraft) {
        const existingRec = applications[job.id];
        const nextResume =
          targetDoc === 'resume'
            ? data.updatedDraft
            : currentResume ||
              existingRec?.tailoredResumeDraft ||
              generateTailoredResumeText(job, profile);
        const nextCover =
          targetDoc === 'cover-letter'
            ? data.updatedDraft
            : currentCoverLetter || existingRec?.coverLetterDraft || '';
        handleSavePackageAndStatus(job.id, nextResume, nextCover);
        return {
          updatedDraft: data.updatedDraft,
          targetDoc: data.targetDoc || targetDoc,
        };
      }
    } catch (err) {
      reportError(err);
    } finally {
      setIsGeneratingLetter(false);
    }
    return {};
  };

  const handlePrepareApplication = async (
    job: ScoredJobListing,
    tailoredResume: string,
    coverLetter: string
  ) => {
    const applicationTab = window.open('about:blank', '_blank');
    try {
      const data = await agentFetch<{
        sourceUrl: string;
        message: string;
        checklist: string[];
        resume: string;
        coverLetter: string;
      }>('/api/agent/prepare-application', {
        job,
        profile,
        tailoredResume,
        coverLetter,
      });
      handleSavePackageAndStatus(job.id, data.resume, data.coverLetter, 'Saved', {
        agentPipelineLog: data.checklist,
      });
      const bundle = `RESUME\n\n${data.resume}\n\nCOVER LETTER\n\n${data.coverLetter}`;
      try {
        await navigator.clipboard.writeText(bundle);
      } catch {
        /* clipboard may be blocked */
      }
      const blob = new Blob([bundle], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${job.company.replace(/\s+/g, '_')}_application.txt`;
      link.click();
      URL.revokeObjectURL(url);
      if (applicationTab) {
        applicationTab.opener = null;
        applicationTab.location.href = data.sourceUrl;
      }
      return {
        message: data.message,
        pipelineLog: data.checklist || [],
        sourceUrl: data.sourceUrl,
      };
    } catch (err) {
      applicationTab?.close();
      reportError(err);
    }
    return null;
  };

  const handleOpenCoverLetterStudio = (jobId: string) => {
    setSelectedJobId(jobId);
    setActiveTab('cover-letter');
  };

  const handleLoadDemoData = () => {
    setJobs(DEMO_JOB_FEED);
    const demoRegion = { preferredCountry: 'United States', salaryCurrency: 'USD', timeZone: 'America/New_York' };
    setProfile({ ...DEMO_CANDIDATE_PROFILE, ...demoRegion, consultationBlueprint: { ...DEMO_CANDIDATE_PROFILE.consultationBlueprint, ...demoRegion } });
    setApplications(DEMO_APPLICATIONS);
    setConsultantMessages(DEMO_CONSULTANT_MESSAGES);
    setSelectedJobId(DEMO_JOB_FEED[0]?.id ?? null);
    setLastScanHeadline(
      'Demo data loaded for Jordan Vance. This is sample content, not a live search.'
    );
    setChatHistoryByJob({});
  };

  const handleResetEmpty = () => {
    setJobs(EMPTY_JOB_FEED);
    setProfile(EMPTY_CANDIDATE_PROFILE);
    setApplications(EMPTY_APPLICATIONS);
    setConsultantMessages(EMPTY_CONSULTANT_MESSAGES);
    setSelectedJobId(null);
    setChatHistoryByJob({});
    setLastScanHeadline(
      'No scan yet. Upload a resume, finish the consultation, then search LinkedIn, Indeed, and Glassdoor.'
    );
  };

  const handleResetAllData = () => {
    handleResetEmpty();
    setAgentMemory(EMPTY_AGENT_MEMORY);
    setSessionMemory({ lastOpenedAt: new Date().toISOString(), lastSummary: '' });
    setChatHistoryByJob({});
    setActiveTab('feed');
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onRunAgentScan={() => handleRunAgentScan()}
        isScanning={isScanning}
        trackedCount={pipelineMetrics.totalTracked}
        onOpenAgentControls={() => setAgentControlsOpen(true)}
        onToggleEmergencyStop={() => void handleToggleEmergencyStop()}
        agentsStopped={agentMonitor?.agentsStopped ?? false}
        activeAgentCount={agentMonitor?.activeTasks.length ?? 0}
      />

      <AgentControlsPanel
        open={agentControlsOpen}
        onClose={() => setAgentControlsOpen(false)}
        monitor={agentMonitor}
        refreshMonitor={refreshAgentMonitor}
        onToggleEmergencyStop={() => void handleToggleEmergencyStop()}
        onError={setGlobalError}
      />

      {globalError && (
        <div
          role="alert"
          className="px-6 py-3 bg-red-50 border-b border-red-200 text-sm text-red-900 flex items-start justify-between gap-4"
        >
          <span>{globalError}</span>
          <button
            type="button"
            onClick={() => setGlobalError(null)}
            className="text-red-700 underline whitespace-nowrap shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      <main className="flex-1">
        {activeTab === 'careerhub' && (
          <CareerHubView
            profile={profile}
            blueprint={profile.consultationBlueprint}
            onUpdateBlueprint={handleUpdateBlueprint}
            onAnalyzeResumeAndLinkedIn={handleAnalyzeResumeAndLinkedIn}
            messages={consultantMessages}
            onSendMessage={handleSendConsultantMessage}
            onEndSessionAndLaunchSearch={handleEndConsultationAndLaunchSearch}
            isConsulting={isConsulting}
            isAnalyzingProfile={isAnalyzingProfile}
            isHandingOff={isScanning}
            onLoadDemoData={handleLoadDemoData}
            onReportError={reportError}
          />
        )}

        {activeTab === 'feed' && (
          <DailyFeedView
            allScoredJobs={allScoredJobs}
            filteredJobs={filteredJobs}
            selectedJob={selectedJob ?? null}
            onSelectJob={setSelectedJobId}
            filters={filters}
            onUpdateFilters={setFilters}
            profile={profile}
            applications={applications}
            onUpdateApplicationStatus={handleUpdateApplicationStatus}
            onOpenCoverLetterStudio={handleOpenCoverLetterStudio}
            onOpenCareerHub={() => setActiveTab('careerhub')}
            onRunCustomScan={(q) => handleRunAgentScan(q)}
            isScanning={isScanning}
            lastScanHeadline={lastScanHeadline}
            partialResults={lastScanPartial}
            onAutoTrackTopMatches={handleAutoTrackTopMatches}
            chatMessages={
              selectedJob ? chatHistoryByJob[selectedJob.id] || [] : []
            }
            onSendInlineCoverLetterPrompt={async (job, instruction) => {
              const res = await handleSendCoverLetterPrompt(
                job,
                instruction,
                'Executive & Impact-Driven',
                applications[job.id]?.coverLetterDraft || '',
                applications[job.id]?.tailoredResumeDraft || '',
                'cover-letter'
              );
              return res.updatedDraft;
            }}
            isGeneratingLetter={isGeneratingLetter}
            lastSessionSummary={sessionMemory.lastSummary}
            returningUser={Boolean(sessionMemory.previousOpenedAt)}
          />
        )}

        {activeTab === 'tracker' && (
          <ApplicationTrackerView
            jobs={allScoredJobs}
            applications={applications}
            onUpdateStatus={handleUpdateApplicationStatus}
            onUpdateNotes={handleUpdateApplicationNotes}
            onOpenCoverLetter={handleOpenCoverLetterStudio}
            onAutoTrackTopMatches={handleAutoTrackTopMatches}
          />
        )}

        {activeTab === 'cover-letter' && (
          <CoverLetterStudio
            jobs={allScoredJobs}
            selectedJob={selectedJob}
            onSelectJob={setSelectedJobId}
            profile={profile}
            onUploadBaseResume={handleUploadBaseResume}
            applicationRecord={
              selectedJob ? applications[selectedJob.id] : undefined
            }
            onSavePackageAndStatus={handleSavePackageAndStatus}
            chatMessages={
              selectedJob
                ? chatHistoryByJob[selectedJob.id] || [
                    {
                      id: 'default-welcome',
                      role: 'agent',
                      content: `Generate a tailored resume from ${profile.baseResumeFileName || 'your uploaded resume'} and a matching cover letter for this role. Then use Prepare & open application — Meridian does not submit forms on job boards.`,
                      timestamp: 'Now',
                    },
                  ]
                : []
            }
            onSendChatPrompt={handleSendCoverLetterPrompt}
            onTailorBothDocuments={handleTailorBothDocuments}
            onPrepareApplication={handlePrepareApplication}
            onMarkSubmitted={handleMarkSubmitted}
            isGenerating={isGeneratingLetter}
            onReportError={reportError}
          />
        )}

        {activeTab === 'preferences' && (
          <PreferencesView
            profile={profile}
            agentMemory={agentMemory}
            lastSessionAt={sessionMemory.previousOpenedAt}
            onSaveData={saveAllDataNow}
            onResetAllData={handleResetAllData}
            onUpdateProfile={setProfile}
            onResetDefaults={handleResetEmpty}
            onLoadDemoData={handleLoadDemoData}
            onReportError={reportError}
          />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white px-6 py-4 text-xs text-slate-500">
        <div className="max-w-[1380px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            Meridian Career Agent · Discovery, tailoring, and application prep. You submit on the job board.
          </span>
          <span className="font-mono tabular-nums">
            Sources: LinkedIn · Indeed · Glassdoor
          </span>
        </div>
      </footer>
    </div>
  );
}
