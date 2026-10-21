import React, { useState } from 'react';
import {
  ApplicationRecord,
  ApplicationStatus,
  CandidateProfile,
  CoverLetterMessage,
  FilterState,
  JobSource,
  ScoredJobListing,
  WorkMode,
} from '../types/career';
import { formatSalaryRange } from '../utils/jobScoring';
import {
  BookmarkCheck,
  Compass,
  ExternalLink,
  FileText,
  Search,
  Send,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';

interface DailyFeedViewProps {
  allScoredJobs: ScoredJobListing[];
  filteredJobs: ScoredJobListing[];
  selectedJob: ScoredJobListing | null;
  onSelectJob: (jobId: string) => void;
  filters: FilterState;
  onUpdateFilters: (next: FilterState) => void;
  profile: CandidateProfile;
  applications: Record<string, ApplicationRecord>;
  onUpdateApplicationStatus: (jobId: string, status: ApplicationStatus) => void;
  onOpenCoverLetterStudio: (jobId: string) => void;
  onOpenCareerHub: () => void;
  onRunCustomScan: (customQuery: string) => Promise<void>;
  isScanning: boolean;
  lastScanHeadline: string;
  onAutoTrackTopMatches: () => number;
  chatMessages: CoverLetterMessage[];
  onSendInlineCoverLetterPrompt: (
    job: ScoredJobListing,
    instruction: string
  ) => Promise<string | undefined>;
  isGeneratingLetter: boolean;
}

const WORK_MODE_OPTIONS: ('All' | WorkMode)[] = [
  'All',
  'Remote',
  'Hybrid',
  'On-site',
];

const SOURCE_OPTIONS: ('All' | JobSource)[] = [
  'All',
  'LinkedIn',
  'Indeed',
  'Glassdoor',
];

export const DailyFeedView: React.FC<DailyFeedViewProps> = ({
  allScoredJobs,
  filteredJobs,
  selectedJob,
  onSelectJob,
  filters,
  onUpdateFilters,
  profile,
  applications,
  onUpdateApplicationStatus,
  onOpenCoverLetterStudio,
  onOpenCareerHub,
  onRunCustomScan,
  isScanning,
  lastScanHeadline,
  onAutoTrackTopMatches,
  onSendInlineCoverLetterPrompt,
  isGeneratingLetter,
}) => {
  const [scanInput, setScanInput] = useState<string>('');
  const [inlineChatInput, setInlineChatInput] = useState<string>('');
  const [autoTrackToast, setAutoTrackToast] = useState<string | null>(null);

  const remoteCount = allScoredJobs.filter((j) => j.workMode === 'Remote').length;
  const hybridCount = allScoredJobs.filter((j) => j.workMode === 'Hybrid').length;
  const onsiteCount = allScoredJobs.filter((j) => j.workMode === 'On-site').length;

  const priorityOneCount = allScoredJobs.filter(
    (j) => j.match.priorityTier === 'Priority 1 · Dream Job & Mutual Fit'
  ).length;

  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onRunCustomScan(scanInput);
    setScanInput('');
  };

  const handleAutoTrackClick = () => {
    const count = onAutoTrackTopMatches();
    setAutoTrackToast(
      count > 0
        ? `Auto-tracked ${count} Priority 1 listing(s) into your Application Pipeline.`
        : 'All Priority 1 listings are already tracked in your Application Pipeline.'
    );
    setTimeout(() => setAutoTrackToast(null), 3500);
  };

  const handleQuickCoverLetterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob || !inlineChatInput.trim() || isGeneratingLetter) return;
    const prompt = inlineChatInput.trim();
    setInlineChatInput('');
    await onSendInlineCoverLetterPrompt(selectedJob, prompt);
  };

  const activeJob = selectedJob || filteredJobs[0] || null;
  const activeRecord = activeJob ? applications[activeJob.id] : undefined;

  return (
    <div className="max-w-[1380px] mx-auto px-6 py-6">
      {/* Agent Executive Digest Bar */}
      <div className="p-5 mb-6 bg-white border border-slate-200 rounded-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-1">
              <span className="font-semibold text-slate-900">
                Daily Organized Feed
              </span>
              <span aria-hidden="true">·</span>
              <span>Sources: LinkedIn, Indeed, Glassdoor</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                Target Floor: ${profile.minSalaryK}k+
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-emerald-700 font-semibold">
                {priorityOneCount} Priority 1 Matches
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 font-display text-balance">
              {lastScanHeadline}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onOpenCareerHub}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Open CareerHub Consultant</span>
            </button>
            <button
              type="button"
              onClick={handleAutoTrackClick}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <BookmarkCheck className="w-3.5 h-3.5" />
              <span>Auto-Track Priority 1 ({priorityOneCount})</span>
            </button>
          </div>
        </div>

        {/* Agent Live Scan Input */}
        <form
          onSubmit={handleScanSubmit}
          className="pt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
        >
          <div className="relative flex-1">
            <Sparkles className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <label htmlFor="agent-scan-query" className="sr-only">
              Instruct AI Agent to scan LinkedIn, Indeed, and Glassdoor
            </label>
            <input
              id="agent-scan-query"
              type="text"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              placeholder="Instruct Job Search Agent: e.g., 'Scan LinkedIn & Glassdoor for Remote Staff TypeScript AI roles above $200k'..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-slate-900"
            />
          </div>
          <button
            type="submit"
            disabled={isScanning}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
          >
            {isScanning ? 'Scanning Sources...' : 'Scan Job Boards'}
          </button>
        </form>

        {autoTrackToast && (
          <div
            role="status"
            className="mt-3 px-3.5 py-2 bg-emerald-50 border border-emerald-200 rounded-md text-xs font-medium text-emerald-900"
          >
            {autoTrackToast}
          </div>
        )}
      </div>

      {/* Quick Filters Bar: Remote / Hybrid + Source + Salary + Search */}
      <div className="p-4 mb-6 bg-white border border-slate-200 rounded-lg space-y-3 overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Quick Filter 1: Remote & Hybrid Segmented Control */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500 mr-1">
              Work Mode:
            </span>
            <div
              role="group"
              aria-label="Quick filter by Remote and Hybrid work modes"
              className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg max-w-full"
            >
              {WORK_MODE_OPTIONS.map((mode) => {
                const isSelected = filters.workMode === mode;
                const count =
                  mode === 'All'
                    ? allScoredJobs.length
                    : mode === 'Remote'
                    ? remoteCount
                    : mode === 'Hybrid'
                    ? hybridCount
                    : onsiteCount;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() =>
                      onUpdateFilters({ ...filters, workMode: mode })
                    }
                    className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      isSelected
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {mode === 'All' ? 'All Modes' : mode}{' '}
                    <span className="font-mono tabular-nums opacity-75">
                      ({count})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Filter 2: Job Board Source (LinkedIn, Indeed, Glassdoor) */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500 mr-1">
              Platform:
            </span>
            <div
              role="group"
              aria-label="Filter by job board source"
              className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg max-w-full"
            >
              {SOURCE_OPTIONS.map((src) => {
                const isSelected = filters.source === src;
                return (
                  <button
                    key={src}
                    type="button"
                    onClick={() =>
                      onUpdateFilters({ ...filters, source: src })
                    }
                    className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      isSelected
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {src === 'All' ? 'All Sources' : src}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Second Filter Row: Keyword Search, Min Salary Slider, Sort By */}
        <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <label htmlFor="feed-keyword-search" className="sr-only">
              Search listings by title, skill, or company
            </label>
            <input
              id="feed-keyword-search"
              type="search"
              value={filters.searchQuery}
              onChange={(e) =>
                onUpdateFilters({ ...filters, searchQuery: e.target.value })
              }
              placeholder="Filter feed by title, company, or skill (e.g. PostgreSQL, Staff)..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <label
                htmlFor="min-salary-filter"
                className="text-xs font-medium text-slate-600 whitespace-nowrap"
              >
                Min Salary:
              </label>
              <select
                id="min-salary-filter"
                value={filters.minSalaryK}
                onChange={(e) =>
                  onUpdateFilters({
                    ...filters,
                    minSalaryK: Number(e.target.value),
                  })
                }
                className="px-2.5 py-1 text-xs font-mono tabular-nums bg-slate-50 border border-slate-300 rounded-md text-slate-900"
              >
                <option value={0}>Any Salary</option>
                <option value={160}>$160k+</option>
                <option value={185}>$185k+ (Target)</option>
                <option value={200}>$200k+</option>
                <option value={220}>$220k+</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label
                htmlFor="sort-by-select"
                className="text-xs font-medium text-slate-600 whitespace-nowrap"
              >
                Sort:
              </label>
              <select
                id="sort-by-select"
                value={filters.sortBy}
                onChange={(e) =>
                  onUpdateFilters({
                    ...filters,
                    sortBy: e.target.value as FilterState['sortBy'],
                  })
                }
                className="px-2.5 py-1 text-xs font-medium bg-slate-50 border border-slate-300 rounded-md text-slate-900"
              >
                <option value="priority">Agent Priority Score</option>
                <option value="salary">Highest Compensation</option>
                <option value="recent">Most Recent</option>
              </select>
            </div>

            {(filters.workMode !== 'All' ||
              filters.source !== 'All' ||
              filters.minSalaryK > 0 ||
              filters.searchQuery !== '') && (
              <button
                type="button"
                onClick={() =>
                  onUpdateFilters({
                    workMode: 'All',
                    source: 'All',
                    minSalaryK: 0,
                    searchQuery: '',
                    sortBy: 'priority',
                    onlyPriorityOne: false,
                  })
                }
                className="text-xs font-medium text-slate-600 hover:text-slate-900 underline whitespace-nowrap shrink-0"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Master-Detail Feed Grid */}
      {filteredJobs.length === 0 ? (
        <div className="p-12 text-center bg-white border border-slate-200 rounded-lg">
          <h2 className="text-base font-semibold text-slate-900 mb-1">
            No listings match your active filter combination
          </h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
            Try relaxing your minimum salary threshold or switching Work Mode back to All Modes.
          </p>
          <button
            type="button"
            onClick={() =>
              onUpdateFilters({
                workMode: 'All',
                source: 'All',
                minSalaryK: 0,
                searchQuery: '',
                sortBy: 'priority',
                onlyPriorityOne: false,
              })
            }
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800"
          >
            Show All {allScoredJobs.length} Feed Listings
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (7 cols): Prioritized Daily Feed List */}
          <div
            role="list"
            aria-label="Prioritized daily job listings"
            className="lg:col-span-7 space-y-3"
          >
            {filteredJobs.map((job, idx) => {
              const isSelected = activeJob?.id === job.id;
              const appRec = applications[job.id];
              const isTracked = appRec && appRec.status !== 'Untracked';

              return (
                <article
                  key={job.id}
                  role="listitem"
                  onClick={() => onSelectJob(job.id)}
                  className={`p-5 bg-white border rounded-lg transition-colors cursor-pointer ${
                    isSelected
                      ? 'border-slate-900 ring-1 ring-slate-900'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Top unboxed metadata kicker (Zero-Pill Discipline) */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 mb-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono tabular-nums font-semibold text-slate-700">
                        {String(idx + 1).padStart(2, '0')}.
                      </span>
                      <span className="font-medium text-slate-800">
                        {job.source}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-medium text-slate-800">
                        {job.workMode}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{job.location}</span>
                      {job.commuteEstimate && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{job.commuteEstimate}</span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span>Posted {job.postedAt}</span>
                    </div>

                    <div className="flex items-center gap-2 font-mono tabular-nums">
                      <span
                        className={`font-semibold ${
                          job.match.overallScore >= 85
                            ? 'text-emerald-700'
                            : job.match.overallScore >= 70
                            ? 'text-slate-800'
                            : 'text-amber-700'
                        }`}
                      >
                        {job.match.overallScore}% Match · {job.match.mutualFitScore}% Mutual Fit
                      </span>
                      {isTracked && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-900 font-semibold">
                            Tracked: {appRec.status}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Primary Title & Compensation */}
                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 mb-2">
                    <h2 className="text-base font-bold text-slate-900 font-display">
                      {job.title}{' '}
                      <span className="font-normal text-slate-600">
                        at {job.company}
                      </span>
                    </h2>
                    <span className="text-sm font-bold text-slate-900 font-mono tabular-nums whitespace-nowrap shrink-0">
                      {formatSalaryRange(job.salaryMinK, job.salaryMaxK)}
                    </span>
                  </div>

                  {/* Agent Executive Summary */}
                  <p className="text-xs text-slate-600 leading-relaxed mb-2">
                    {job.agentSummary}
                  </p>

                  {/* Why Company Will Love Having You on Their Team */}
                  {job.whyCompanyLovesYou && (
                    <p className="text-xs text-emerald-900 bg-emerald-50/70 border border-emerald-200/80 rounded px-2.5 py-1.5 mb-2 leading-relaxed">
                      <span className="font-semibold">
                        Why {job.company} Will Love You:
                      </span>{' '}
                      {job.whyCompanyLovesYou}
                    </p>
                  )}

                  {/* Holistic CareerHub Fit Indicators (Unboxed inline text) */}
                  {(job.workLifeBalanceNote || job.securityAndProgressionNote) && (
                    <div className="text-[11px] text-slate-500 mb-3">
                      {job.workLifeBalanceNote && (
                        <span>{job.workLifeBalanceNote}</span>
                      )}
                      {job.workLifeBalanceNote &&
                        job.securityAndProgressionNote && (
                          <span aria-hidden="true"> · </span>
                        )}
                      {job.securityAndProgressionNote && (
                        <span>{job.securityAndProgressionNote}</span>
                      )}
                    </div>
                  )}

                  {/* Unboxed Skill Alignment & Quick Actions */}
                  <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="text-xs text-slate-500">
                      <span className="font-medium text-slate-700">
                        Matched skills ({job.match.matchedSkills.length}/
                        {job.requiredSkills.length + job.preferredSkills.length}):
                      </span>{' '}
                      <span>
                        {job.match.matchedSkills.join(' · ') || 'None'}
                      </span>
                    </div>

                    <div
                      className="flex items-center gap-2 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => onOpenCoverLetterStudio(job.id)}
                        aria-label={`Tailor resume and cover letter for ${job.title} at ${job.company}`}
                        className="px-3 py-1.5 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0"
                      >
                        Tailor Resume & Cover Letter
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          onUpdateApplicationStatus(
                            job.id,
                            isTracked && appRec.status === 'Saved'
                              ? 'Applied'
                              : 'Saved'
                          )
                        }
                        aria-label={
                          isTracked
                            ? `Advance tracking stage for ${job.company}`
                            : `Save ${job.title} at ${job.company} to tracker`
                        }
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                          isTracked
                            ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                            : 'bg-slate-900 text-white hover:bg-slate-800'
                        }`}
                      >
                        {isTracked ? `Stage: ${appRec.status}` : 'Save & Track'}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Right Column (5 cols): Selected Role Deep-Dive & Quick Multi-Agent Handoff */}
          {activeJob && (
            <aside
              aria-label="Selected role details and quick cover letter assistant"
              className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 sticky top-20 space-y-5"
            >
              {/* Role Header */}
              <div className="pb-4 border-b border-slate-200">
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 mb-1">
                  <span className="font-semibold text-slate-800">
                    {activeJob.company}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{activeJob.source}</span>
                  <span aria-hidden="true">·</span>
                  <span>{activeJob.workMode}</span>
                  <span aria-hidden="true">·</span>
                  <span>{activeJob.department}</span>
                </div>

                <h2 className="text-lg font-bold text-slate-900 font-display mb-2">
                  {activeJob.title}
                </h2>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-mono tabular-nums font-bold text-slate-900 text-sm">
                    {formatSalaryRange(
                      activeJob.salaryMinK,
                      activeJob.salaryMaxK
                    )}{' '}
                    {activeJob.equity ? `· ${activeJob.equity}` : ''}
                  </span>
                  <a
                    href={activeJob.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 underline whitespace-nowrap shrink-0"
                  >
                    <span>Open on {activeJob.source}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Priority Score Breakdown Grid */}
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-semibold text-slate-900">
                    Dream Job & Mutual Fit Breakdown
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-emerald-700">
                    {activeJob.match.priorityTier}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 p-3 bg-slate-50 border border-slate-200/80 rounded-lg text-center">
                  <div>
                    <div className="text-[11px] text-slate-500">Overall</div>
                    <div className="text-base font-bold text-slate-900 font-mono tabular-nums">
                      {activeJob.match.overallScore}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500">Mutual Fit</div>
                    <div className="text-base font-bold text-emerald-700 font-mono tabular-nums">
                      {activeJob.match.mutualFitScore}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500">Skill Fit</div>
                    <div className="text-base font-bold text-slate-900 font-mono tabular-nums">
                      {activeJob.match.skillScore}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500">Salary Fit</div>
                    <div className="text-base font-bold text-slate-900 font-mono tabular-nums">
                      {activeJob.match.salaryScore}%
                    </div>
                  </div>
                </div>

                {activeJob.whyCompanyLovesYou && (
                  <div className="mt-2.5 p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-md">
                    <div className="text-[11px] font-semibold text-emerald-900">
                      Why {activeJob.company} Will Love Having You on Their Team
                    </div>
                    <p className="text-xs text-emerald-950 mt-0.5 leading-relaxed">
                      {activeJob.whyCompanyLovesYou}
                    </p>
                  </div>
                )}

                <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
                  {activeJob.whyItMatches}
                </p>
              </div>

              {/* Key Responsibilities */}
              <div className="space-y-1.5">
                <h3 className="text-xs font-semibold text-slate-900">
                  Key Role Mandates
                </h3>
                <ul className="space-y-1 text-xs text-slate-600 list-disc pl-4">
                  {activeJob.keyResponsibilities.map((resp, i) => (
                    <li key={i} className="leading-relaxed">
                      {resp}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Multi-Agent Tailor & Auto-Apply Action Box */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
                <div className="text-xs font-semibold text-slate-900">
                  Multi-Agent Application Pipeline
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Launch the <strong>Resume Tailoring Agent</strong> (from{' '}
                  <span className="font-mono">{profile.baseResumeFileName}</span>)
                  and <strong>Cover Letter Agent</strong>, then confirm the{' '}
                  <strong>Auto-Apply Agent</strong>.
                </p>
                <button
                  type="button"
                  onClick={() => onOpenCoverLetterStudio(activeJob.id)}
                  className="w-full py-2 px-3 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Open Tailor & Auto-Apply Studio for {activeJob.company}
                </button>
              </div>

              {/* Built-In Quick Cover Letter Drafting Chat */}
              <div className="pt-3 border-t border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-700" />
                    <h3 className="text-xs font-semibold text-slate-900">
                      Quick Cover Letter Agent
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenCoverLetterStudio(activeJob.id)}
                    className="text-xs font-medium text-slate-700 hover:text-slate-900 underline whitespace-nowrap shrink-0"
                  >
                    Full Studio
                  </button>
                </div>

                {activeRecord?.coverLetterDraft ? (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 max-h-36 overflow-y-auto whitespace-pre-line leading-relaxed">
                    {activeRecord.coverLetterDraft}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Ask the agent below to draft a customized cover letter for{' '}
                    <span className="font-medium text-slate-800">
                      {activeJob.company}
                    </span>
                    .
                  </p>
                )}

                <form
                  onSubmit={handleQuickCoverLetterSubmit}
                  className="flex items-center gap-2"
                >
                  <label
                    htmlFor="inspector-cover-letter-input"
                    className="sr-only"
                  >
                    Quick Cover Letter Chat Prompt
                  </label>
                  <input
                    id="inspector-cover-letter-input"
                    type="text"
                    value={inlineChatInput}
                    onChange={(e) => setInlineChatInput(e.target.value)}
                    placeholder={`Draft cover letter for ${activeJob.company}...`}
                    className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-slate-900"
                  />
                  <button
                    type="submit"
                    disabled={isGeneratingLetter || !inlineChatInput.trim()}
                    aria-label="Generate cover letter draft"
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Send className="w-3 h-3" />
                    <span>{isGeneratingLetter ? 'Drafting...' : 'Draft'}</span>
                  </button>
                </form>
              </div>
            </aside>
          )}
        </div>
      )}
    </div>
  );
};
