/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
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
  DEFAULT_CANDIDATE_PROFILE,
  INITIAL_APPLICATIONS,
  INITIAL_CONSULTANT_MESSAGES,
  INITIAL_JOB_FEED,
} from './data/seedJobs';
import {
  applyBlueprintToProfile,
  calculateJobMatch,
  computePipelineMetrics,
  generateTailoredResumeText,
  prioritizeAndFilterJobs,
} from './utils/jobScoring';
import { ActiveTab, TopBar } from './components/TopBar';
import { CareerHubView } from './components/CareerHubView';
import { DailyFeedView } from './components/DailyFeedView';
import { ApplicationTrackerView } from './components/ApplicationTrackerView';
import { CoverLetterStudio } from './components/CoverLetterStudio';
import { PreferencesView } from './components/PreferencesView';

const STORAGE_KEYS = {
  JOBS: 'meridian_career_jobs_v3',
  PROFILE: 'meridian_career_profile_v3',
  APPLICATIONS: 'meridian_career_applications_v3',
};

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('careerhub');

  const [jobs, setJobs] = useState<JobListing[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.JOBS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return INITIAL_JOB_FEED;
  });

  const [profile, setProfile] = useState<CandidateProfile>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PROFILE);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.consultationBlueprint && parsed.baseResumeText) {
          return parsed;
        }
      }
    } catch {
      // ignore storage errors
    }
    return DEFAULT_CANDIDATE_PROFILE;
  });

  const [applications, setApplications] = useState<
    Record<string, ApplicationRecord>
  >(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.APPLICATIONS);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore storage errors
    }
    return INITIAL_APPLICATIONS;
  });

  const [consultantMessages, setConsultantMessages] = useState<
    ConsultantChatMessage[]
  >(INITIAL_CONSULTANT_MESSAGES);
  const [isConsulting, setIsConsulting] = useState<boolean>(false);
  const [isAnalyzingProfile, setIsAnalyzingProfile] = useState<boolean>(false);

  const [filters, setFilters] = useState<FilterState>({
    workMode: 'All',
    source: 'All',
    minSalaryK: 0,
    searchQuery: '',
    sortBy: 'priority',
    onlyPriorityOne: false,
  });

  const [selectedJobId, setSelectedJobId] = useState<string>(
    INITIAL_JOB_FEED[0].id
  );
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [lastScanHeadline, setLastScanHeadline] = useState<string>(
    '7 high-signal roles indexed today across LinkedIn, Indeed & Glassdoor, ranked by your CareerHub Blueprint and $185k+ base target'
  );
  const [isGeneratingLetter, setIsGeneratingLetter] = useState<boolean>(false);
  const [chatHistoryByJob, setChatHistoryByJob] = useState<
    Record<string, CoverLetterMessage[]>
  >({
    'li-901': [
      {
        id: 'init-msg-1',
        role: 'agent',
        content:
          'Resume Tailoring Agent and Cover Letter Agent prepared your initial application package for Veridian Labs based on Jordan_Vance_Base_Resume_2026.pdf.',
        timestamp: '08:30 AM',
      },
    ],
  });

  // Persist state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.JOBS, JSON.stringify(jobs));
    } catch {
      // ignore
    }
  }, [jobs]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
    } catch {
      // ignore
    }
  }, [profile]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.APPLICATIONS,
        JSON.stringify(applications)
      );
    } catch {
      // ignore
    }
  }, [applications]);

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

  const selectedJob: ScoredJobListing = useMemo(() => {
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

  // CareerHub Consultant Chat Handler
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
    setConsultantMessages((prev) => [...prev, userMsg]);

    try {
      const response = await fetch('/api/agent/consultant-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          profile,
          currentBlueprint: profile.consultationBlueprint,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.updatedBlueprint) {
          setProfile((prev) =>
            applyBlueprintToProfile(prev, data.updatedBlueprint)
          );
        }
        const agentMsg: ConsultantChatMessage = {
          id: `consult-agent-${Date.now()}`,
          role: 'consultant',
          content: data.reply,
          timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          extractedInsights: data.extractedInsights,
        };
        setConsultantMessages((prev) => [...prev, agentMsg]);
      }
    } catch (err) {
      console.error('Consultant chat error:', err);
    } finally {
      setIsConsulting(false);
    }
  };

  // Zero-Friction Resume + LinkedIn Profile Analysis by Career Consultant Agent
  const handleAnalyzeResumeAndLinkedIn = async (
    resumeText: string,
    resumeFileName: string,
    linkedInUrl: string,
    linkedInSummary: string,
    autoLaunchJobSearch = false
  ) => {
    setIsAnalyzingProfile(true);
    try {
      const response = await fetch('/api/agent/analyze-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeText,
          resumeFileName,
          linkedInUrl,
          linkedInSummary,
          profile,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const nextBlueprint: ConsultationBlueprint =
          data.updatedBlueprint || profile.consultationBlueprint;
        const mergedSkills = Array.from(
          new Set([...(data.detectedSkills || []), ...profile.skills])
        );

        const nextProfile = applyBlueprintToProfile(
          {
            ...profile,
            baseResumeText: resumeText,
            baseResumeFileName: resumeFileName,
            linkedInUrl,
            linkedInSummary,
            skills: mergedSkills,
            profileAnalyzedAt: new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
          },
          nextBlueprint
        );

        setProfile(nextProfile);

        const agentMsg: ConsultantChatMessage = {
          id: `consult-analyze-${Date.now()}`,
          role: 'consultant',
          content: data.reply,
          timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          extractedInsights: data.extractedInsights,
        };
        setConsultantMessages((prev) => [...prev, agentMsg]);

        if (autoLaunchJobSearch) {
          await handleRunAgentScan(
            nextBlueprint.recommendedRoles[0] || 'Staff AI Product Engineer',
            nextProfile,
            true
          );
        }
      }
    } catch (err) {
      console.error('Resume & LinkedIn analysis error:', err);
    } finally {
      setIsAnalyzingProfile(false);
    }
  };

  // Automatic Handoff: Career Consultant Agent -> Job Search Agent
  const handleEndConsultationAndLaunchSearch = async (
    finalBlueprint: ConsultationBlueprint
  ) => {
    const updatedProfile = applyBlueprintToProfile(profile, finalBlueprint);
    setProfile(updatedProfile);
    await handleRunAgentScan(
      finalBlueprint.recommendedRoles[0] || 'Principal AI Product Architect',
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
    setApplications((prev) => {
      const existing = prev[jobId];
      return {
        ...prev,
        [jobId]: {
          jobId,
          status,
          updatedAt: new Date().toISOString(),
          appliedAt: status === 'Applied' ? 'Oct 20, 2026' : existing?.appliedAt,
          nextStep:
            existing?.nextStep ||
            (status === 'Saved'
              ? 'Review tailored resume & cover letter, then confirm Auto-Apply Agent'
              : status === 'Applied'
              ? 'Follow up with hiring team in 5 business days'
              : status === 'Interviewing'
              ? 'Prepare system design & architecture walkthrough'
              : ''),
          notes:
            existing?.notes || `Tracked via Meridian Career Agent (${status}).`,
          tailoredResumeDraft: existing?.tailoredResumeDraft,
          coverLetterDraft: existing?.coverLetterDraft,
          autoTrackedByAgent: existing?.autoTrackedByAgent ?? false,
          autoAppliedByAgent: existing?.autoAppliedByAgent ?? false,
          confirmationId: existing?.confirmationId,
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
          updatedAt: new Date().toISOString(),
        },
      };
    });
  };

  const handleSavePackageAndStatus = (
    jobId: string,
    tailoredResume: string,
    coverLetter: string,
    status?: ApplicationStatus
  ) => {
    setApplications((prev) => {
      const existing = prev[jobId];
      const nextStatus = status || existing?.status || 'Saved';
      return {
        ...prev,
        [jobId]: {
          jobId,
          status: nextStatus,
          updatedAt: new Date().toISOString(),
          appliedAt:
            nextStatus === 'Applied' ? 'Oct 20, 2026' : existing?.appliedAt,
          nextStep:
            existing?.nextStep ||
            (nextStatus === 'Applied'
              ? 'Monitor recruiter response'
              : 'Confirm Auto-Apply Agent dispatch'),
          notes:
            existing?.notes ||
            'Tailored resume and cover letter prepared in Application Studio.',
          tailoredResumeDraft: tailoredResume,
          coverLetterDraft: coverLetter,
          autoTrackedByAgent: existing?.autoTrackedByAgent ?? false,
          autoAppliedByAgent: existing?.autoAppliedByAgent ?? false,
          confirmationId: existing?.confirmationId,
          agentPipelineLog: existing?.agentPipelineLog,
        },
      };
    });
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
            nextStep: 'Review tailored resume & cover letter & confirm Auto-Apply',
            notes: `Auto-queued by Meridian Agent (${job.match.overallScore}% priority match on ${job.source}).`,
            tailoredResumeDraft: generateTailoredResumeText(job, profile),
            autoTrackedByAgent: true,
          };
        }
      }
    }

    if (newlyAdded > 0) {
      setApplications(nextApps);
    }
    return newlyAdded;
  };

  const handleRunAgentScan = async (
    customQuery?: string,
    overrideProfile?: CandidateProfile,
    fromConsultationHandoff = false
  ) => {
    if (isScanning) return;
    setIsScanning(true);
    const activeProfile = overrideProfile || profile;
    try {
      const response = await fetch('/api/agent/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: activeProfile,
          query: customQuery || '',
          preferredSource: filters.source,
          preferredWorkMode: filters.workMode,
          fromConsultationHandoff,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.jobs) && data.jobs.length > 0) {
          setJobs((prev) => [...data.jobs, ...prev]);
          setSelectedJobId(data.jobs[0].id);
          if (data.scanHeadline) {
            setLastScanHeadline(data.scanHeadline);
          }
          setActiveTab('feed');
        }
      }
    } catch (err) {
      console.error('Agent scan error:', err);
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
      const response = await fetch('/api/agent/tailor-package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job,
          profile,
          tone,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        const agentMsg: CoverLetterMessage = {
          id: `agent-pkg-${Date.now()}`,
          role: 'agent',
          content:
            data.agentSummary ||
            `Resume Tailoring Agent and Cover Letter Agent generated a tailored application package for ${job.company}.`,
          timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        };
        setChatHistoryByJob((prev) => ({
          ...prev,
          [job.id]: [...(prev[job.id] || []), agentMsg],
        }));

        handleSavePackageAndStatus(
          job.id,
          data.tailoredResume,
          data.coverLetter,
          applications[job.id]?.status || 'Saved'
        );

        return {
          tailoredResume: data.tailoredResume,
          coverLetter: data.coverLetter,
          agentSummary: data.agentSummary,
        };
      }
    } catch (err) {
      console.error('Tailor package error:', err);
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
      const response = await fetch('/api/agent/cover-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const agentMsg: CoverLetterMessage = {
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
        };

        setChatHistoryByJob((prev) => ({
          ...prev,
          [job.id]: [...(prev[job.id] || []), agentMsg],
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
      }
    } catch (err) {
      console.error('Document refinement error:', err);
    } finally {
      setIsGeneratingLetter(false);
    }
    return {};
  };

  const handleConfirmAutoApply = async (
    job: ScoredJobListing,
    tailoredResume: string,
    coverLetter: string
  ) => {
    try {
      const response = await fetch('/api/agent/auto-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job,
          profile,
          tailoredResume,
          coverLetter,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setApplications((prev) => ({
          ...prev,
          [job.id]: {
            jobId: job.id,
            status: 'Applied',
            updatedAt: new Date().toISOString(),
            appliedAt: data.appliedAt || 'Oct 20, 2026',
            nextStep: 'Monitor recruiter response (Auto-Applied by Agent)',
            notes: `Auto-Apply Agent submitted tailored resume + cover letter (${data.confirmationId}).`,
            tailoredResumeDraft: tailoredResume,
            coverLetterDraft: coverLetter,
            autoTrackedByAgent: true,
            autoAppliedByAgent: true,
            confirmationId: data.confirmationId,
            agentPipelineLog: data.pipelineLog,
          },
        }));
        return {
          confirmationId: data.confirmationId,
          message: data.message,
          pipelineLog: data.pipelineLog || [],
        };
      }
    } catch (err) {
      console.error('Auto-apply error:', err);
    }
    return null;
  };

  const handleOpenCoverLetterStudio = (jobId: string) => {
    setSelectedJobId(jobId);
    setActiveTab('cover-letter');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onRunAgentScan={() => handleRunAgentScan()}
        isScanning={isScanning}
        trackedCount={pipelineMetrics.totalTracked}
      />

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
          />
        )}

        {activeTab === 'feed' && (
          <DailyFeedView
            allScoredJobs={allScoredJobs}
            filteredJobs={filteredJobs}
            selectedJob={selectedJob}
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
            onAutoTrackTopMatches={handleAutoTrackTopMatches}
            chatMessages={chatHistoryByJob[selectedJob.id] || []}
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
            applicationRecord={applications[selectedJob.id]}
            onSavePackageAndStatus={handleSavePackageAndStatus}
            chatMessages={
              chatHistoryByJob[selectedJob.id] || [
                {
                  id: 'default-welcome',
                  role: 'agent',
                  content: `Resume Tailoring Agent and Cover Letter Agent have prepared a customized resume (from ${profile.baseResumeFileName}) and cover letter for ${selectedJob.title} at ${selectedJob.company}. Review or refine either document, then click "Confirm & Auto-Apply with Agent".`,
                  timestamp: 'Now',
                },
              ]
            }
            onSendChatPrompt={handleSendCoverLetterPrompt}
            onTailorBothDocuments={handleTailorBothDocuments}
            onConfirmAutoApply={handleConfirmAutoApply}
            isGenerating={isGeneratingLetter}
          />
        )}

        {activeTab === 'preferences' && (
          <PreferencesView
            profile={profile}
            onUpdateProfile={setProfile}
            onResetDefaults={() => setProfile(DEFAULT_CANDIDATE_PROFILE)}
          />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white px-6 py-4 text-xs text-slate-500">
        <div className="max-w-[1380px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            Meridian Career Agent · 5-Agent Autonomous Discovery, Tailoring & Application Pipeline
          </span>
          <span className="font-mono tabular-nums">
            Sources: LinkedIn · Indeed · Glassdoor
          </span>
        </div>
      </footer>
    </div>
  );
}
