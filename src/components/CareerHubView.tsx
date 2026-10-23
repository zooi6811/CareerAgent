import React, { useEffect, useRef, useState } from 'react';
import {
  CandidateProfile,
  ConsultantChatMessage,
  ConsultationBlueprint,
  WorkMode,
} from '../types/career';
import { ingestResumeFile } from '../utils/resumeIngest';
import { formatAgentError } from '../utils/agentApi';
import { COUNTRY_OPTIONS, currencyForCountry, formatAnnualSalary, salaryCeiling, timeZoneForCountry } from '../utils/localePreferences';
import {
  ArrowRight,
  Compass,
  FileText,
  Send,
  Sparkles,
  Upload,
  Zap,
} from 'lucide-react';

interface CareerHubViewProps {
  profile: CandidateProfile;
  blueprint: ConsultationBlueprint;
  onUpdateBlueprint: (updated: ConsultationBlueprint) => void;
  onAnalyzeResumeAndLinkedIn: (
    resumeText: string,
    resumeFileName: string,
    linkedInUrl: string,
    linkedInSummary: string,
    autoLaunchJobSearch?: boolean
  ) => Promise<boolean>;
  messages: ConsultantChatMessage[];
  onSendMessage: (message: string) => Promise<void>;
  onEndSessionAndLaunchSearch: (
    finalBlueprint: ConsultationBlueprint
  ) => Promise<void>;
  isConsulting: boolean;
  isAnalyzingProfile: boolean;
  isHandingOff: boolean;
  onLoadDemoData: () => void;
  onReportError: (err: unknown) => void;
}

const DISCOVERY_PROMPTS = [
  'Based on my resume, what kind of company and role look like a realistic fit?',
  'I want remote or low-commute hybrid work. Help me set location and commute in the blueprint.',
  'I care about work-life balance, job security, and a clear progression path.',
  'Help me set a compensation floor from my experience, without inflating it.',
];

export const CareerHubView: React.FC<CareerHubViewProps> = ({
  profile,
  blueprint,
  onUpdateBlueprint,
  onAnalyzeResumeAndLinkedIn,
  messages,
  onSendMessage,
  onEndSessionAndLaunchSearch,
  isConsulting,
  isAnalyzingProfile,
  isHandingOff,
  onLoadDemoData,
  onReportError,
}) => {
  const [chatInput, setChatInput] = useState<string>('');
  const [passionInput, setPassionInput] = useState<string>('');
  const [locationDraft, setLocationDraft] = useState<string>(blueprint.targetLocations.join(', '));
  const [resumeText, setResumeText] = useState<string>(profile.baseResumeText);
  const [resumeFileName, setResumeFileName] = useState<string>(
    profile.baseResumeFileName
  );
  const [linkedInUrl, setLinkedInUrl] = useState<string>(profile.linkedInUrl);
  const [linkedInSummary, setLinkedInSummary] = useState<string>(
    profile.linkedInSummary
  );
  const [showSourceEditors, setShowSourceEditors] = useState<boolean>(false);
  const [analysisStatusBanner, setAnalysisStatusBanner] = useState<string | null>(
    null
  );
  const conversationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setResumeText(profile.baseResumeText);
    setResumeFileName(profile.baseResumeFileName);
    setLinkedInUrl(profile.linkedInUrl);
    setLinkedInSummary(profile.linkedInSummary);
  }, [profile.baseResumeText, profile.baseResumeFileName, profile.linkedInUrl, profile.linkedInSummary]);

  useEffect(() => { setLocationDraft(blueprint.targetLocations.join(', ')); }, [blueprint.targetLocations]);
  useEffect(() => { conversationRef.current?.scrollTo({ top: conversationRef.current.scrollHeight, behavior: 'smooth' }); }, [messages.length, isConsulting]);

  const handleSend = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isConsulting) return;
    setChatInput('');
    await onSendMessage(trimmed);
  };

  const hasAnalyzed = Boolean(profile.profileAnalyzedAt);
  const onboardingIncomplete = !resumeText.trim();

  const handleResumeFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = await ingestResumeFile(file);
      setResumeFileName(parsed.fileName);
      setResumeText(parsed.text);
      setShowSourceEditors(true);
      setAnalysisStatusBanner(
        `Loaded "${parsed.fileName}". Review the extracted text, optionally paste LinkedIn About & Experience, then analyze.`
      );
    } catch (err) {
      onReportError(err);
      setAnalysisStatusBanner(formatAgentError(err));
    }
  };

  const handleLinkedInExportUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = await ingestResumeFile(file);
      setLinkedInSummary(parsed.text);
      setShowSourceEditors(true);
      setAnalysisStatusBanner(
        `Loaded LinkedIn export "${parsed.fileName}". A profile URL is not fetched — only this pasted/exported text is analyzed.`
      );
    } catch (err) {
      onReportError(err);
    }
  };

  const handleRunProfileAnalysis = async (autoLaunchJobSearch = false) => {
    setAnalysisStatusBanner(null);
    const success = await onAnalyzeResumeAndLinkedIn(
      resumeText,
      resumeFileName,
      linkedInUrl,
      linkedInSummary,
      autoLaunchJobSearch
    );
    if (success && !autoLaunchJobSearch) {
      setAnalysisStatusBanner(
        `Career Consultant Agent analyzed ${resumeFileName} and the text you provided — extracted strengths and synced your Dream Job Blueprint.`
      );
    }
  };

  const handleAddPassion = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = passionInput.trim();
    if (!trimmed) return;
    if (!blueprint.corePassions.includes(trimmed)) {
      onUpdateBlueprint({
        ...blueprint,
        corePassions: [...blueprint.corePassions, trimmed],
      });
    }
    setPassionInput('');
  };

  const handleToggleMode = (mode: WorkMode) => {
    const exists = blueprint.preferredWorkModes.includes(mode);
    const next = exists
      ? blueprint.preferredWorkModes.filter((m) => m !== mode)
      : [...blueprint.preferredWorkModes, mode];
    if (next.length === 0) return;
    onUpdateBlueprint({
      ...blueprint,
      preferredWorkModes: next,
    });
  };

  return (
    <section className="max-w-[1380px] mx-auto px-6 py-6">
      {/* Multi-Agent Pipeline & Zero-Friction Header */}
      <div className="p-5 mb-6 bg-white border border-slate-200 rounded-lg space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <p className="text-xs text-slate-500 mb-1">
              CareerHub · Resume & LinkedIn text analysis · Blueprint for job search
            </p>
            <h1 className="text-2xl font-bold text-slate-900 font-display">
              Career Consultant Agent & Passion Blueprint
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onLoadDemoData}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              Load demo data
            </button>
            <button
              type="button"
              onClick={() => handleRunProfileAnalysis(true)}
              disabled={isAnalyzingProfile || isHandingOff || onboardingIncomplete}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-900 bg-emerald-50 border border-emerald-300 rounded-lg hover:bg-emerald-100 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
            >
              <Zap className="w-3.5 h-3.5 text-emerald-700" />
              <span>
                {isAnalyzingProfile && isHandingOff
                  ? 'Express Matching Dream Jobs...'
                  : '1-Click Express: Analyze & Find Dream Jobs'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onEndSessionAndLaunchSearch(blueprint)}
              disabled={isHandingOff || isAnalyzingProfile || !hasAnalyzed}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {isHandingOff
                  ? 'Handing off to Job Search Agent...'
                  : 'End Consultation & Launch Job Search'}
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Zero-Friction Resume & LinkedIn Ingestion Bar */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold text-slate-900">
                  Onboarding: resume required, LinkedIn text optional
                </span>
                <span aria-hidden="true" className="text-slate-400">
                  ·
                </span>
                <span className="font-mono text-slate-600">
                  Resume: {resumeFileName || 'none'}
                </span>
                <span aria-hidden="true" className="text-slate-400">
                  ·
                </span>
                <span className="font-mono text-slate-600">
                  LinkedIn text: {linkedInSummary.trim() ? 'pasted' : 'not provided'}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                A LinkedIn URL cannot be fetched (login wall). Paste your About and Experience, or upload a LinkedIn PDF export. Then analyze, consult, and hand off the blueprint to search.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-md cursor-pointer transition-colors whitespace-nowrap shrink-0">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Resume</span>
                <input
                  type="file"
                  accept=".txt,.md,.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleResumeFileUpload}
                  className="sr-only"
                  aria-label="Upload existing resume file for Career Consultant analysis"
                />
              </label>

              <button
                type="button"
                onClick={() => setShowSourceEditors((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>
                  {showSourceEditors
                    ? 'Hide Resume & LinkedIn Editor'
                    : 'Edit Resume & LinkedIn Profile'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleRunProfileAnalysis(false)}
                disabled={isAnalyzingProfile || onboardingIncomplete}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {isAnalyzingProfile
                    ? 'Analyzing Resume & LinkedIn...'
                    : 'Analyze Resume & LinkedIn Profile'}
                </span>
              </button>
            </div>
          </div>

          {showSourceEditors && (
            <div className="pt-3 border-t border-slate-200 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="careerhub-resume-textarea"
                  className="block text-xs font-semibold text-slate-900 mb-1"
                >
                  Existing Resume Content ({resumeFileName})
                </label>
                <textarea
                  id="careerhub-resume-textarea"
                  rows={5}
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  className="w-full p-2.5 text-xs font-mono bg-white border border-slate-300 rounded-md text-slate-800 leading-relaxed"
                />
              </div>

              <div className="space-y-2.5">
                <div>
                  <label
                    htmlFor="careerhub-linkedin-url"
                    className="block text-xs font-semibold text-slate-900 mb-1"
                  >
                    LinkedIn Profile URL (optional reference only — not fetched)
                  </label>
                  <input
                    id="careerhub-linkedin-url"
                    type="text"
                    value={linkedInUrl}
                    onChange={(e) => setLinkedInUrl(e.target.value)}
                    placeholder="https://www.linkedin.com/in/your-profile"
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md text-slate-800"
                  />
                </div>
                <div>
                  <label className="inline-flex items-center gap-1.5 mb-1 px-2 py-1 text-[11px] font-medium text-slate-700 bg-white border border-slate-300 rounded cursor-pointer">
                    <Upload className="w-3 h-3" />
                    Upload LinkedIn PDF export
                    <input
                      type="file"
                      accept=".pdf,.txt,.md,.docx"
                      onChange={handleLinkedInExportUpload}
                      className="sr-only"
                    />
                  </label>
                  <label
                    htmlFor="careerhub-linkedin-summary"
                    className="block text-xs font-semibold text-slate-900 mb-1"
                  >
                    Paste LinkedIn About & Experience
                  </label>
                  <textarea
                    id="careerhub-linkedin-summary"
                    rows={3}
                    value={linkedInSummary}
                    onChange={(e) => setLinkedInSummary(e.target.value)}
                    className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-md text-slate-800 leading-relaxed"
                  />
                </div>
              </div>
            </div>
          )}

          {analysisStatusBanner && (
            <div
              role="status"
              className="px-3.5 py-2 bg-emerald-50 border border-emerald-200 rounded-md text-xs font-medium text-emerald-900"
            >
              {analysisStatusBanner}
            </div>
          )}
        </div>

        {/* 5-Agent Connected Pipeline Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <div className="p-3 bg-slate-900 text-white rounded-md">
            <div className="font-mono tabular-nums text-[11px] opacity-75">
              01. Active Agent
            </div>
            <div className="font-semibold mt-0.5">Career Consultant Agent</div>
            <div className="text-[11px] opacity-80 mt-0.5">
              Analyzes Resume & LinkedIn + maps passion & WLB
            </div>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
            <div className="font-mono tabular-nums text-[11px] text-slate-500">
              02. Auto-Triggered Next
            </div>
            <div className="font-semibold text-slate-900 mt-0.5">
              Job Search Agent
            </div>
            <div className="text-[11px] text-slate-600 mt-0.5">
              Finds Dream Jobs & Mutual Fit teams
            </div>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
            <div className="font-mono tabular-nums text-[11px] text-slate-500">
              03. On Role Selection
            </div>
            <div className="font-semibold text-slate-900 mt-0.5">
              Resume Tailoring Agent
            </div>
            <div className="text-[11px] text-slate-600 mt-0.5">
              Rewrites uploaded resume for target role
            </div>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
            <div className="font-mono tabular-nums text-[11px] text-slate-500">
              04. Co-Drafting Agent
            </div>
            <div className="font-semibold text-slate-900 mt-0.5">
              Cover Letter Agent
            </div>
            <div className="text-[11px] text-slate-600 mt-0.5">
              Drafts matching cover letter pitch
            </div>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
            <div className="font-mono tabular-nums text-[11px] text-slate-500">
              05. Upon Confirmation
            </div>
            <div className="font-semibold text-slate-900 mt-0.5">
              Application Prep Agent
            </div>
            <div className="text-[11px] text-slate-600 mt-0.5">
              Exports your package and opens the real posting
            </div>
          </div>
        </div>
      </div>

      {/* Main 2-Column Split: Consultant Chat on Left, Live Holistic Career Blueprint on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Column: Career Consultant Agent Chat */}
        <div className="lg:col-span-6 lg:self-start flex flex-col gap-4 bg-white border border-slate-200 rounded-lg p-5">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-slate-800" />
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Career Consultant Session
                  </h2>
                  <p className="text-xs text-slate-500">
                    Grounded in your Resume & LinkedIn · Refine passion, commute, WLB, security & pay
                  </p>
                </div>
              </div>
            </div>

            {/* Guided Discovery Prompts */}
            <div className="mb-4">
              <p className="text-xs font-medium text-slate-500 mb-2">
                Explore with Consultant:
              </p>
              <div className="grid grid-cols-1 gap-1.5">
                {DISCOVERY_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={isConsulting || !hasAnalyzed}
                    onClick={() => handleSend(prompt)}
                    className="text-left px-3 py-2 text-xs text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-md transition-colors disabled:opacity-50"
                  >
                    “{prompt}”
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Conversation Feed */}
            <div
              aria-label="Career Consultant conversation"
              ref={conversationRef}
              className="space-y-3 max-h-[min(42vh,400px)] min-h-0 overflow-y-auto overscroll-contain scroll-smooth pr-1"
            >
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-3.5 rounded-lg text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-slate-900 text-white ml-8'
                      : 'bg-slate-100 text-slate-800 mr-4'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] opacity-75 mb-1">
                    <span className="font-semibold">
                      {msg.role === 'user' ? 'You' : 'Career Consultant Agent'}
                    </span>
                    <span className="font-mono tabular-nums">{msg.timestamp}</span>
                  </div>
                  <p>{msg.content}</p>
                  {msg.extractedInsights && msg.extractedInsights.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-200/60 text-[11px] text-emerald-800 font-medium">
                      Blueprint Synced: {msg.extractedInsights.join(' · ')}
                    </div>
                  )}
                </div>
              ))}
              {isConsulting && (
                <div className="p-3 rounded-lg text-xs bg-slate-100 text-slate-700">
                  Career Consultant Agent is synthesizing your preferences into your Dream Job Blueprint...
                </div>
              )}
            </div>
          </div>

          {/* Chat Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(chatInput);
            }}
            className="pt-3 border-t border-slate-200 flex items-center gap-2"
          >
            <label htmlFor="consultant-chat-input" className="sr-only">
              Chat with Career Consultant Agent
            </label>
            <input
              id="consultant-chat-input"
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={
                hasAnalyzed
                  ? 'Share passions, commute, work-life balance, or target salary...'
                  : 'Analyze your resume first, then chat'
              }
              disabled={!hasAnalyzed}
              className="flex-1 px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-slate-900"
            />
            <button
              type="submit"
              disabled={isConsulting || !chatInput.trim() || !hasAnalyzed}
              aria-label="Send message to Career Consultant"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </form>
        </div>

        {/* Right Column: Live Holistic Consultation Blueprint Matrix + Mutual Fit DNA */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Live Dream Job & Mutual Fit Blueprint
              </h2>
              <p className="text-xs text-slate-500">
                Calibrated from Resume & LinkedIn · Directly transmitted to Job Search Agent
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-emerald-700 font-semibold">
              Ready for Handoff
            </span>
          </div>

          {/* Resume & LinkedIn Extracted Superpowers & Ideal Company DNA */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
            <div>
              <div className="text-[11px] font-semibold text-slate-500 mb-0.5">
                Why Companies Will Love Having You on Their Team (Extracted Superpowers)
              </div>
              <ul className="space-y-1 text-xs text-slate-800 list-disc pl-4">
                {(blueprint.extractedSuperpowers &&
                blueprint.extractedSuperpowers.length > 0
                  ? blueprint.extractedSuperpowers
                  : ['Run analysis on your resume to extract strengths from the documents.']
                ).map((sp, i) => (
                  <li key={i} className="leading-relaxed">
                    {sp}
                  </li>
                ))}
              </ul>
            </div>

            {blueprint.idealCompanyDNA && (
              <div className="pt-2 border-t border-slate-200/80">
                <div className="text-[11px] font-semibold text-slate-500 mb-0.5">
                  Ideal Company DNA (Mutual Team Match)
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {blueprint.idealCompanyDNA}
                </p>
              </div>
            )}

            <div className="pt-2 border-t border-slate-200/80">
              <div className="text-[11px] font-semibold text-slate-500 mb-0.5">
                Consultant Passion & Dream Job Synthesis
              </div>
              <p className="text-xs text-slate-800 leading-relaxed">
                {blueprint.consultantSummary ||
                  'No blueprint yet. Analyze your resume to populate this.'}
              </p>
            </div>
          </div>

          {/* 1. Core Passions & Interests */}
          <div>
            <label
              htmlFor="add-passion-input"
              className="block text-xs font-semibold text-slate-900 mb-1"
            >
              1. Core Passions & Interests
            </label>
            <div className="text-xs text-slate-700 mb-2">
              {blueprint.corePassions.join(' · ')}
            </div>
            <form onSubmit={handleAddPassion} className="flex items-center gap-2">
              <input
                id="add-passion-input"
                type="text"
                value={passionInput}
                onChange={(e) => setPassionInput(e.target.value)}
                placeholder="Add a core passion or domain interest..."
                className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-md"
              />
              <button
                type="submit"
                className="px-3 py-1.5 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-md whitespace-nowrap shrink-0"
              >
                Add Passion
              </button>
            </form>
          </div>

          {/* Grid of Holistic Dimensions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-slate-100">
            <div>
              <label
                htmlFor="bp-locations"
                className="block text-xs font-semibold text-slate-900 mb-1"
              >
                2. Preferred work locations
              </label>
              <textarea
                id="bp-locations"
                rows={2}
                value={locationDraft}
                placeholder="Separate cities with commas, e.g. Kuala Lumpur, George Town, Remote"
                onChange={(e) => setLocationDraft(e.target.value)}
                onBlur={() => onUpdateBlueprint({ ...blueprint, targetLocations: [...new Set(locationDraft.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean))] })}
                className="w-full resize-y px-3 py-1.5 text-xs border border-slate-300 rounded-md"
              />
              <p className="mt-1 text-[10px] text-slate-500">Add multiple cities separated by commas, semicolons, or new lines. Spaces and punctuation are allowed.</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="bp-commute"
                  className="text-xs font-semibold text-slate-900"
                >
                3. Max commute (minutes)
                </label>
                <span className="text-xs font-mono tabular-nums font-bold text-slate-900">
                  {blueprint.maxCommuteMinutes === 0
                    ? '0 min (Remote)'
                    : `≤ ${blueprint.maxCommuteMinutes} min`}
                </span>
              </div>
              <input
                id="bp-commute"
                type="range"
                min={0}
                max={60}
                step={5}
                value={blueprint.maxCommuteMinutes}
                onChange={(e) =>
                  onUpdateBlueprint({
                    ...blueprint,
                    maxCommuteMinutes: Number(e.target.value),
                  })
                }
                className="w-full accent-slate-900 cursor-pointer"
              />
              <p className="mt-1 text-[10px] text-slate-500">Used to guide local job searches. Travel times are not calculated; commute fit is ranked from the posting’s stated location.</p>
            </div>

            <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-xs font-semibold text-slate-900">Location & local settings</p>
              <p className="mb-3 text-[11px] text-slate-600">Used to tailor salary expectations, job searches, and scheduling to your market.</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium text-slate-700">Country or market
                  <input list="career-country-options" value={blueprint.preferredCountry || profile.preferredCountry || ''} onChange={e=>{
                    const country=e.target.value; const currency=currencyForCountry(country);
                    onUpdateBlueprint({...blueprint,preferredCountry:country,...(currency?{salaryCurrency:currency}:{}),...(timeZoneForCountry(country)?{timeZone:timeZoneForCountry(country)}:{}),minSalaryK:0,compensationExpectation:''});
                  }} placeholder="Choose or type a country" className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs" />
                  <datalist id="career-country-options">{COUNTRY_OPTIONS.map(([code,name])=><option key={code} value={name}/>)}</datalist>
                </label>
                <label className="text-xs font-medium text-slate-700">Salary currency
                  <input maxLength={3} value={blueprint.salaryCurrency || profile.salaryCurrency || 'USD'} onChange={e=>onUpdateBlueprint({...blueprint,salaryCurrency:e.target.value.toUpperCase(),minSalaryK:0,compensationExpectation:''})} placeholder="e.g. MYR" className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs uppercase" />
                </label>
                <label className="text-xs font-medium text-slate-700">Your time zone
                  <input value={blueprint.timeZone || profile.timeZone || 'UTC'} onChange={e=>onUpdateBlueprint({...blueprint,timeZone:e.target.value})} placeholder="e.g. Asia/Kuala_Lumpur" className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs" />
                </label>
                <label className="text-xs font-medium text-slate-700">Where are you based?
                  <input value={blueprint.homeLocation || profile.homeLocation || ''} onChange={e=>onUpdateBlueprint({...blueprint,homeLocation:e.target.value})} placeholder="Your city or area, e.g. Petaling Jaya, Selangor" autoComplete="address-level2" className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs" />
                  <span className={`mt-1 block text-[10px] font-normal ${blueprint.homeLocation || profile.homeLocation ? 'text-slate-500' : 'text-amber-700'}`}>{blueprint.homeLocation || profile.homeLocation ? 'Used as your commute starting point. Keep this separate from cities where you’re willing to work.' : 'Add your city or area to personalize commute fit. Until then, location scoring stays neutral.'}</span>
                </label>
              </div>
            </div>

            <div>
              <label
                htmlFor="bp-environment"
                className="block text-xs font-semibold text-slate-900 mb-1"
              >
                4. Work Environment & Mode
              </label>
              <div className="flex items-center gap-1.5 mb-1.5">
                {(['Remote', 'Hybrid', 'On-site'] as WorkMode[]).map((mode) => {
                  const active = blueprint.preferredWorkModes.includes(mode);
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => handleToggleMode(mode)}
                      className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-600 border-slate-300'
                      }`}
                    >
                      {mode}
                    </button>
                  );
                })}
              </div>
              <input
                id="bp-environment"
                type="text"
                value={blueprint.workEnvironment}
                onChange={(e) =>
                  onUpdateBlueprint({
                    ...blueprint,
                    workEnvironment: e.target.value,
                  })
                }
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="bp-salary"
                  className="text-xs font-semibold text-slate-900"
                >
                  5. Annual base salary target ({blueprint.salaryCurrency || profile.salaryCurrency || 'USD'})
                </label>
                <span className="text-xs font-mono tabular-nums font-bold text-slate-900">
                  {formatAnnualSalary(blueprint.minSalaryK,blueprint.salaryCurrency || profile.salaryCurrency || 'USD')}+ / year
                </span>
              </div>
              <input
                id="bp-salary"
                type="range"
                min={0}
                max={salaryCeiling(blueprint.salaryCurrency || profile.salaryCurrency)}
                step={salaryCeiling(blueprint.salaryCurrency || profile.salaryCurrency) > 1000 ? 100 : 5}
                value={blueprint.minSalaryK}
                onChange={(e) =>
                  onUpdateBlueprint({
                    ...blueprint,
                    minSalaryK: Number(e.target.value),
                    compensationExpectation: `${blueprint.salaryCurrency || profile.salaryCurrency || 'USD'} ${Number(e.target.value)*1000}+ annual base salary; benefits and equity considered separately`,
                  })
                }
                className="w-full accent-slate-900 cursor-pointer mb-1.5"
              />
              <input
                type="text"
                aria-label="Compensation package details"
                value={blueprint.compensationExpectation}
                onChange={(e) =>
                  onUpdateBlueprint({
                    ...blueprint,
                    compensationExpectation: e.target.value,
                  })
                }
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
              />
              <p className="mt-1 text-[10px] text-slate-500">Set the lowest annual base pay you’d consider. Currency and market follow your location settings.</p>
            </div>

            <div>
              <label
                htmlFor="bp-wlb"
                className="block text-xs font-semibold text-slate-900 mb-1"
              >
                6. Work-Life Balance Priority
              </label>
              <input
                id="bp-wlb"
                type="text"
                value={blueprint.workLifeBalancePriority}
                onChange={(e) =>
                  onUpdateBlueprint({
                    ...blueprint,
                    workLifeBalancePriority: e.target.value,
                  })
                }
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
              />
            </div>

            <div>
              <label
                htmlFor="bp-security"
                className="block text-xs font-semibold text-slate-900 mb-1"
              >
                7. Job Security & Runway
              </label>
              <input
                id="bp-security"
                type="text"
                value={blueprint.jobSecurityPriority}
                onChange={(e) =>
                  onUpdateBlueprint({
                    ...blueprint,
                    jobSecurityPriority: e.target.value,
                  })
                }
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="bp-progression"
              className="block text-xs font-semibold text-slate-900 mb-1"
            >
              8. Career Progression & Growth Trajectory
            </label>
            <input
              id="bp-progression"
              type="text"
              value={blueprint.progressionGoal}
              onChange={(e) =>
                onUpdateBlueprint({
                  ...blueprint,
                  progressionGoal: e.target.value,
                })
              }
              className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              Target Roles: {blueprint.recommendedRoles.join(' · ')}
            </span>
            <button
              type="button"
              onClick={() => onEndSessionAndLaunchSearch(blueprint)}
              disabled={isHandingOff}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
            >
              <span>
                {isHandingOff
                  ? 'Launching Job Search Agent...'
                  : 'Complete Session & Search Jobs'}
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
