import React, { useState } from 'react';
import {
  ApplicationRecord,
  ApplicationStatus,
  CandidateProfile,
  CoverLetterMessage,
  ScoredJobListing,
} from '../types/career';
import {
  formatSalaryRange,
  generateTailoredResumeText,
} from '../utils/jobScoring';
import {
  Check,
  CheckCircle2,
  Copy,
  FileText,
  Send,
  Sparkles,
  Upload,
} from 'lucide-react';

interface CoverLetterStudioProps {
  jobs: ScoredJobListing[];
  selectedJob: ScoredJobListing;
  onSelectJob: (jobId: string) => void;
  profile: CandidateProfile;
  onUploadBaseResume: (fileName: string, content: string) => void;
  applicationRecord?: ApplicationRecord;
  onSavePackageAndStatus: (
    jobId: string,
    tailoredResume: string,
    coverLetter: string,
    status?: ApplicationStatus
  ) => void;
  chatMessages: CoverLetterMessage[];
  onSendChatPrompt: (
    job: ScoredJobListing,
    instruction: string,
    tone: string,
    currentCoverLetter: string,
    currentResume: string,
    targetDoc: 'resume' | 'cover-letter'
  ) => Promise<{ updatedDraft?: string; targetDoc?: 'resume' | 'cover-letter' }>;
  onTailorBothDocuments: (
    job: ScoredJobListing,
    tone: string
  ) => Promise<{
    tailoredResume: string;
    coverLetter: string;
    agentSummary: string;
  } | null>;
  onConfirmAutoApply: (
    job: ScoredJobListing,
    tailoredResume: string,
    coverLetter: string
  ) => Promise<{
    confirmationId: string;
    message: string;
    pipelineLog: string[];
  } | null>;
  isGenerating: boolean;
}

const TONE_OPTIONS = [
  'Executive & Impact-Driven',
  'Technical & Architectural',
  'Concise & Direct',
];

const QUICK_PROMPTS = [
  'Emphasize my distributed systems scale and p95 latency reduction.',
  'Highlight how my skills align with their compensation tier and remote culture.',
  'Reorder resume bullets to lead with TypeScript, React, and LLM orchestration.',
  'Make the opening paragraph punchier for the VP of Engineering.',
];

export const CoverLetterStudio: React.FC<CoverLetterStudioProps> = ({
  jobs,
  selectedJob,
  onSelectJob,
  profile,
  onUploadBaseResume,
  applicationRecord,
  onSavePackageAndStatus,
  chatMessages,
  onSendChatPrompt,
  onTailorBothDocuments,
  onConfirmAutoApply,
  isGenerating,
}) => {
  const buildDefaultCoverLetter = (job: ScoredJobListing) => `Dear ${job.company} Engineering Leadership,

I am writing to express my strong interest in the ${job.title} position at ${job.company} (discovered via ${job.source}), alongside my tailored resume. With ${profile.yearsExperience}+ years of experience building production systems with ${job.match.matchedSkills.slice(0, 4).join(', ') || profile.skills.slice(0, 4).join(', ')}, my background aligns closely with your mandate in ${job.department}.

In my recent work as a ${profile.headline}, I ${
    profile.keyAchievements[0]
      ? profile.keyAchievements[0].charAt(0).toLowerCase() +
        profile.keyAchievements[0].slice(1)
      : 'architected high-throughput distributed services and AI agent workflows.'
  } Additionally, I ${
    profile.keyAchievements[1]
      ? profile.keyAchievements[1].charAt(0).toLowerCase() +
        profile.keyAchievements[1].slice(1)
      : 'led cross-functional platform modernizations with measurable infrastructure savings.'
  }

I welcome the opportunity to discuss how my technical leadership can support ${job.company}'s engineering roadmap.

Sincerely,
${profile.fullName}`;

  const [activeDocTab, setActiveDocTab] = useState<
    'resume' | 'cover-letter' | 'base-resume'
  >('resume');
  const [resumeText, setResumeText] = useState<string>(
    applicationRecord?.tailoredResumeDraft ||
      generateTailoredResumeText(selectedJob, profile)
  );
  const [coverLetterText, setCoverLetterText] = useState<string>(
    applicationRecord?.coverLetterDraft || buildDefaultCoverLetter(selectedJob)
  );
  const [selectedTone, setSelectedTone] = useState<string>(TONE_OPTIONS[0]);
  const [chatInput, setChatInput] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [applyReceipt, setApplyReceipt] = useState<{
    confirmationId: string;
    message: string;
    pipelineLog: string[];
  } | null>(null);

  // Sync documents when selectedJob or profile changes
  React.useEffect(() => {
    setResumeText(
      applicationRecord?.tailoredResumeDraft ||
        generateTailoredResumeText(selectedJob, profile)
    );
    setCoverLetterText(
      applicationRecord?.coverLetterDraft || buildDefaultCoverLetter(selectedJob)
    );
    setShowConfirmModal(false);
  }, [
    selectedJob.id,
    applicationRecord?.tailoredResumeDraft,
    applicationRecord?.coverLetterDraft,
    profile.baseResumeText,
  ]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const textContent =
        typeof reader.result === 'string' && reader.result.trim().length > 0
          ? reader.result
          : `UPLOADED RESUME (${file.name})\n${profile.baseResumeText}`;
      onUploadBaseResume(file.name, textContent);
      setStatusBanner(
        `Uploaded "${file.name}" — Resume Tailoring Agent automatically recalibrated your tailored resume for ${selectedJob.company}.`
      );
      setTimeout(() => setStatusBanner(null), 4000);
    };
    reader.readAsText(file);
  };

  const handleRunBothAgents = async () => {
    const res = await onTailorBothDocuments(selectedJob, selectedTone);
    if (res) {
      setResumeText(res.tailoredResume);
      setCoverLetterText(res.coverLetter);
      setStatusBanner(res.agentSummary);
      setTimeout(() => setStatusBanner(null), 4500);
    }
  };

  const handlePromptSubmit = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed || isGenerating) return;
    setChatInput('');
    const targetDoc: 'resume' | 'cover-letter' =
      activeDocTab === 'resume' ? 'resume' : 'cover-letter';
    const result = await onSendChatPrompt(
      selectedJob,
      trimmed,
      selectedTone,
      coverLetterText,
      resumeText,
      targetDoc
    );
    if (result?.updatedDraft) {
      if (result.targetDoc === 'resume') {
        setResumeText(result.updatedDraft);
      } else {
        setCoverLetterText(result.updatedDraft);
      }
    }
  };

  const handleCopy = async () => {
    const textToCopy =
      activeDocTab === 'resume'
        ? resumeText
        : activeDocTab === 'cover-letter'
        ? coverLetterText
        : profile.baseResumeText;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSavePackage = (status?: ApplicationStatus) => {
    onSavePackageAndStatus(
      selectedJob.id,
      resumeText,
      coverLetterText,
      status
    );
    setStatusBanner(
      status
        ? `Tailored Resume & Cover Letter saved and role marked as ${status}.`
        : 'Tailored Resume & Cover Letter package saved.'
    );
    setTimeout(() => setStatusBanner(null), 3500);
  };

  const handleExecuteAutoApply = async () => {
    setIsApplying(true);
    try {
      const receipt = await onConfirmAutoApply(
        selectedJob,
        resumeText,
        coverLetterText
      );
      if (receipt) {
        setApplyReceipt(receipt);
        setShowConfirmModal(false);
      }
    } finally {
      setIsApplying(false);
    }
  };

  const currentEditorText =
    activeDocTab === 'resume'
      ? resumeText
      : activeDocTab === 'cover-letter'
      ? coverLetterText
      : profile.baseResumeText;

  const wordCount = currentEditorText
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  return (
    <section className="max-w-[1380px] mx-auto px-6 py-6">
      {/* Top Role Selector & Base Resume Upload Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 mb-6 border-b border-slate-200">
        <div>
          <p className="text-xs text-slate-500 mb-1">
            Multi-Agent Application Studio · Resume Tailoring Agent + Cover Letter Agent + Auto-Apply Agent
          </p>
          <h1 className="text-2xl font-bold text-slate-900 font-display">
            Tailor Resume, Cover Letter & Auto-Apply
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Upload Existing Resume Control */}
          <label className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors whitespace-nowrap shrink-0">
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Base Resume ({profile.baseResumeFileName})</span>
            <input
              type="file"
              accept=".txt,.md,.pdf,.doc,.docx,.json"
              onChange={handleFileUpload}
              className="sr-only"
            />
          </label>

          <label
            htmlFor="studio-role-select"
            className="text-xs font-medium text-slate-600 whitespace-nowrap"
          >
            Target Role:
          </label>
          <select
            id="studio-role-select"
            value={selectedJob.id}
            onChange={(e) => onSelectJob(e.target.value)}
            className="px-3 py-2 text-xs sm:text-sm font-medium bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.company} — {j.title} ({j.match.overallScore}% Match ·{' '}
                {formatSalaryRange(j.salaryMinK, j.salaryMaxK)})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Role Context & Dual-Agent Trigger Strip */}
      <div className="p-4 mb-6 bg-white border border-slate-200 rounded-lg flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-900">
              {selectedJob.company}
            </span>
            <span aria-hidden="true">·</span>
            <span>{selectedJob.source}</span>
            <span aria-hidden="true">·</span>
            <span>{selectedJob.workMode}</span>
            <span aria-hidden="true">·</span>
            <span>{selectedJob.location}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-slate-800">
              {formatSalaryRange(selectedJob.salaryMinK, selectedJob.salaryMaxK)}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums font-semibold text-emerald-700">
              {selectedJob.match.overallScore}% Priority Match
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-700">
            {selectedJob.whyItMatches}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {TONE_OPTIONS.map((tone) => (
              <button
                key={tone}
                type="button"
                onClick={() => setSelectedTone(tone)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  selectedTone === tone
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tone}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleRunBothAgents}
            disabled={isGenerating}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>
              {isGenerating
                ? 'Tailoring Package...'
                : 'Generate Tailored Resume & Cover Letter'}
            </span>
          </button>
        </div>
      </div>

      {statusBanner && (
        <div
          role="status"
          className="mb-5 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-medium text-emerald-900 flex items-center justify-between"
        >
          <span>{statusBanner}</span>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="text-emerald-700 underline ml-4 whitespace-nowrap"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Auto-Apply Confirmation Panel (When User Clicks "Confirm & Auto-Apply") */}
      {showConfirmModal && (
        <div
          role="dialog"
          aria-label="Confirm Auto-Apply Agent Submission"
          className="mb-6 p-5 bg-slate-900 text-white rounded-lg border border-slate-800 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <div>
              <div className="text-xs font-mono tabular-nums text-emerald-400">
                Agent #5 · Final Submission Confirmation Required
              </div>
              <h2 className="text-base font-bold font-display mt-0.5">
                Confirm Auto-Apply Agent Dispatch to {selectedJob.company} (
                {selectedJob.title})
              </h2>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-300">
              Platform: {selectedJob.source} · {formatSalaryRange(selectedJob.salaryMinK, selectedJob.salaryMaxK)}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-3 bg-slate-800/90 rounded-md">
              <div className="font-semibold text-white mb-1">
                1. Tailored Resume Attached (Resume Tailoring Agent)
              </div>
              <p className="text-slate-300 line-clamp-3">
                Derived from {profile.baseResumeFileName} · Aligned with{' '}
                {selectedJob.match.matchedSkills.join(', ')} ({resumeText.split(/\s+/).filter(Boolean).length} words).
              </p>
            </div>
            <div className="p-3 bg-slate-800/90 rounded-md">
              <div className="font-semibold text-white mb-1">
                2. Tailored Cover Letter Attached (Cover Letter Agent)
              </div>
              <p className="text-slate-300 line-clamp-3">
                {coverLetterText.slice(0, 180)}... ({coverLetterText.split(/\s+/).filter(Boolean).length} words).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowConfirmModal(false)}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white transition-colors"
            >
              Cancel & Review Documents
            </button>
            <button
              type="button"
              onClick={handleExecuteAutoApply}
              disabled={isApplying}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-900 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isApplying
                  ? 'Submitting Application...'
                  : 'Confirm & Dispatch Auto-Apply Agent'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Auto-Apply Completed Receipt & Multi-Agent Audit Trail */}
      {applyReceipt && (
        <div
          role="status"
          className="mb-6 p-5 bg-emerald-50 border border-emerald-200 rounded-lg space-y-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
              <h2 className="text-sm font-bold text-emerald-950">
                {applyReceipt.message}
              </h2>
            </div>
            <span className="text-xs font-mono tabular-nums font-semibold text-emerald-800">
              Receipt: #{applyReceipt.confirmationId}
            </span>
          </div>
          <div className="space-y-1 text-xs font-mono text-emerald-900 bg-white/80 p-3 rounded border border-emerald-200/70">
            {applyReceipt.pipelineLog.map((entry, idx) => (
              <div key={idx}>{entry}</div>
            ))}
          </div>
        </div>
      )}

      {/* Main 2-Column Split: Agent Chat on Left, Dual Document Editor (Tailored Resume + Cover Letter) on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Column: Multi-Agent Refinement Chat */}
        <div className="lg:col-span-5 flex flex-col bg-white border border-slate-200 rounded-lg p-5 justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {activeDocTab === 'resume'
                    ? 'Resume Tailoring Agent Chat'
                    : 'Cover Letter Agent Chat'}
                </h2>
                <p className="text-xs text-slate-500">
                  Currently refining:{' '}
                  <span className="font-semibold text-slate-800">
                    {activeDocTab === 'resume'
                      ? 'Role-Tailored Resume'
                      : 'Role-Tailored Cover Letter'}
                  </span>
                </p>
              </div>
            </div>

            {/* Quick Refinement Prompts */}
            <div className="mb-4">
              <p className="text-xs font-medium text-slate-500 mb-2">
                Quick Agent Instructions:
              </p>
              <div className="flex flex-col gap-1.5">
                {QUICK_PROMPTS.map((qp, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={isGenerating}
                    onClick={() => handlePromptSubmit(qp)}
                    className="text-left px-3 py-2 text-xs text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-md transition-colors disabled:opacity-50"
                  >
                    “{qp}”
                  </button>
                ))}
              </div>
            </div>

            {/* Conversation History */}
            <div
              aria-label="Cover letter chat messages"
              className="space-y-3 max-h-[280px] overflow-y-auto pr-1 mb-4"
            >
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-3 rounded-lg text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-slate-900 text-white ml-6'
                      : 'bg-slate-100 text-slate-800 mr-4'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] opacity-75 mb-1">
                    <span className="font-semibold">
                      {msg.role === 'user' ? 'You' : 'Meridian Tailoring Agent'}
                    </span>
                    <span className="font-mono tabular-nums">{msg.timestamp}</span>
                  </div>
                  <p>{msg.content}</p>
                </div>
              ))}
              {isGenerating && (
                <div className="p-3 rounded-lg text-xs bg-slate-100 text-slate-700">
                  Synthesizing tailored update for{' '}
                  <span className="font-semibold">{selectedJob.company}</span>...
                </div>
              )}
            </div>
          </div>

          {/* Chat Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handlePromptSubmit(chatInput);
            }}
            className="pt-3 border-t border-slate-200 flex items-center gap-2"
          >
            <label htmlFor="cover-letter-chat-input" className="sr-only">
              Instruction for Tailoring Agent
            </label>
            <input
              id="cover-letter-chat-input"
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={`Instruct ${
                activeDocTab === 'resume' ? 'Resume Agent' : 'Cover Letter Agent'
              }...`}
              className="flex-1 px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-slate-900"
            />
            <button
              type="submit"
              disabled={isGenerating || !chatInput.trim()}
              aria-label="Send tailoring instruction"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Refine</span>
            </button>
          </form>
        </div>

        {/* Right Column: Dual Document Workspace (Tailored Resume + Tailored Cover Letter + Auto-Apply) */}
        <div className="lg:col-span-7 flex flex-col bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-slate-200">
            {/* Document Switcher Tabs */}
            <div
              role="group"
              aria-label="Select document to inspect or edit"
              className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
            >
              <button
                type="button"
                onClick={() => setActiveDocTab('resume')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  activeDocTab === 'resume'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                1. Tailored Resume
              </button>
              <button
                type="button"
                onClick={() => setActiveDocTab('cover-letter')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  activeDocTab === 'cover-letter'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                2. Tailored Cover Letter
              </button>
              <button
                type="button"
                onClick={() => setActiveDocTab('base-resume')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  activeDocTab === 'base-resume'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Uploaded Base Resume
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleSavePackage('Saved')}
                className="px-3 py-1.5 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Save Package
              </button>

              <button
                type="button"
                onClick={() => setShowConfirmModal(true)}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Confirm & Auto-Apply with Agent
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
              <FileText className="w-3.5 h-3.5" />
              {activeDocTab === 'resume'
                ? `Tailored Resume for ${selectedJob.company} (Derived from ${profile.baseResumeFileName})`
                : activeDocTab === 'cover-letter'
                ? `Tailored Cover Letter for ${selectedJob.company}`
                : `Uploaded Base Resume (${profile.baseResumeFileName})`}
            </span>
            <span className="font-mono tabular-nums">{wordCount} words</span>
          </div>

          <label htmlFor="document-studio-textarea" className="sr-only">
            Document Text Editor
          </label>
          <textarea
            id="document-studio-textarea"
            value={currentEditorText}
            onChange={(e) => {
              if (activeDocTab === 'resume') {
                setResumeText(e.target.value);
              } else if (activeDocTab === 'cover-letter') {
                setCoverLetterText(e.target.value);
              } else {
                onUploadBaseResume(profile.baseResumeFileName, e.target.value);
              }
            }}
            rows={18}
            className="w-full flex-1 p-4 text-sm leading-relaxed text-slate-800 bg-slate-50/60 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:ring-2 focus:ring-slate-900 resize-y font-sans"
          />

          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <div>
              Matched skills incorporated:{' '}
              <span className="text-slate-800 font-medium">
                {selectedJob.match.matchedSkills.join(' · ') ||
                  'Core Engineering Stack'}
              </span>
            </div>
            <div className="font-mono tabular-nums">
              Status: {applicationRecord?.status || 'Untracked'}
              {applicationRecord?.confirmationId
                ? ` · #${applicationRecord.confirmationId}`
                : ''}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
