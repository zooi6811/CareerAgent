import React, { useState } from 'react';
import {
  ApplicationRecord,
  ApplicationStatus,
  ScoredJobListing,
} from '../types/career';
import {
  computePipelineMetrics,
  formatSalaryRange,
} from '../utils/jobScoring';
import { ExternalLink, FileText, Plus, Sparkles } from 'lucide-react';

interface ApplicationTrackerViewProps {
  jobs: ScoredJobListing[];
  applications: Record<string, ApplicationRecord>;
  onUpdateStatus: (jobId: string, status: ApplicationStatus) => void;
  onUpdateNotes: (jobId: string, notes: string, nextStep: string) => void;
  onOpenCoverLetter: (jobId: string) => void;
  onAutoTrackTopMatches: () => number;
}

const STATUS_STAGES: ('All' | ApplicationStatus)[] = [
  'All',
  'Saved',
  'Applied',
  'Interviewing',
  'Offer',
  'Archived',
];

export const ApplicationTrackerView: React.FC<ApplicationTrackerViewProps> = ({
  jobs,
  applications,
  onUpdateStatus,
  onUpdateNotes,
  onOpenCoverLetter,
  onAutoTrackTopMatches,
}) => {
  const [stageFilter, setStageFilter] = useState<'All' | ApplicationStatus>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState<string>('');
  const [nextStepInput, setNextStepInput] = useState<string>('');
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  const metrics = computePipelineMetrics(applications);

  const trackedRows = jobs
    .filter((job) => {
      const rec = applications[job.id];
      if (!rec || rec.status === 'Untracked') return false;
      if (stageFilter !== 'All' && rec.status !== stageFilter) return false;
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        return (
          job.title.toLowerCase().includes(q) ||
          job.company.toLowerCase().includes(q) ||
          job.source.toLowerCase().includes(q) ||
          rec.notes.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .map((job) => ({
      job,
      record: applications[job.id],
    }));

  const handleStartEdit = (jobId: string, currentRec: ApplicationRecord) => {
    setEditingJobId(jobId);
    setNoteInput(currentRec.notes || '');
    setNextStepInput(currentRec.nextStep || '');
  };

  const handleSaveEdit = (jobId: string) => {
    onUpdateNotes(jobId, noteInput, nextStepInput);
    setEditingJobId(null);
    setFeedbackBanner('Updated application notes and next action step.');
    setTimeout(() => setFeedbackBanner(null), 3000);
  };

  const handleAutoTrack = () => {
    const added = onAutoTrackTopMatches();
    setFeedbackBanner(
      added > 0
        ? `Agent automatically added ${added} Priority 1 role(s) (≥85% match) to your pipeline.`
        : 'All Priority 1 roles (≥85% match) are already tracked in your pipeline.'
    );
    setTimeout(() => setFeedbackBanner(null), 4000);
  };

  return (
    <section className="max-w-[1380px] mx-auto px-6 py-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 mb-6 border-b border-slate-200">
        <div>
          <p className="text-xs text-slate-500 mb-1">
            Saved roles, application stages, and prepared documents
          </p>
          <h1 className="text-2xl font-bold text-slate-900 font-display">
            Application Tracker
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleAutoTrack}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Auto-Track Priority 1 Matches</span>
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <p className="text-xs text-slate-500">Total Tracked</p>
          <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
            {metrics.totalTracked}
          </p>
        </div>
        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <p className="text-xs text-slate-500">Saved Queue</p>
          <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
            {metrics.savedCount}
          </p>
        </div>
        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <p className="text-xs text-slate-500">Applied (user confirmed)</p>
          <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
            {metrics.appliedCount}
          </p>
        </div>
        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <p className="text-xs text-slate-500">Interviewing</p>
          <p className="text-2xl font-bold text-emerald-700 font-mono tabular-nums mt-1">
            {metrics.interviewingCount}
          </p>
        </div>
        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <p className="text-xs text-slate-500">Resumes Tailored</p>
          <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
            {metrics.resumesTailored}
          </p>
        </div>
        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <p className="text-xs text-slate-500">Cover Letters Ready</p>
          <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
            {metrics.coverLettersDrafted}
          </p>
        </div>
      </div>

      {feedbackBanner && (
        <div
          role="status"
          className="mb-5 px-4 py-3 bg-slate-900 text-white rounded-lg text-xs font-medium flex items-center justify-between"
        >
          <span>{feedbackBanner}</span>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="text-slate-300 hover:text-white underline ml-4 whitespace-nowrap"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Stage Filter & Search Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div
          role="group"
          aria-label="Filter applications by stage"
          className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto"
        >
          {STATUS_STAGES.map((stage) => (
            <button
              key={stage}
              type="button"
              onClick={() => setStageFilter(stage)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                stageFilter === stage
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {stage}
            </button>
          ))}
        </div>

        <div className="w-full md:w-72">
          <label htmlFor="tracker-search" className="sr-only">
            Search tracked applications
          </label>
          <input
            id="tracker-search"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by company, role, or notes..."
            className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>
      </div>

      {/* High-Density Pipeline Table */}
      {trackedRows.length === 0 ? (
        <div className="p-12 text-center bg-white border border-slate-200 rounded-lg">
          <h2 className="text-base font-semibold text-slate-900 mb-1">
            No applications in this stage
          </h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
            Save roles from the Daily Feed or let the agent automatically queue all Priority 1 opportunities that match your skills and salary target.
          </p>
          <button
            type="button"
            onClick={handleAutoTrack}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Auto-Track Priority 1 Matches</span>
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-500">
                <th className="py-3 px-4">Role & Company</th>
                <th className="py-3 px-4">Source & Work Mode</th>
                <th className="py-3 px-4 text-right">Compensation</th>
                <th className="py-3 px-4 text-right">Match</th>
                <th className="py-3 px-4">Stage</th>
                <th className="py-3 px-4">Next Step, Documents & Agent Notes</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {trackedRows.map(({ job, record }) => {
                const isEditing = editingJobId === job.id;
                return (
                  <tr
                    key={job.id}
                    className="hover:bg-slate-50/80 transition-colors align-top"
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">
                        {job.title}
                      </div>
                      <div className="text-slate-500 mt-0.5">
                        {job.company} · {job.location}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                      {job.source} · {job.workMode}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap">
                      {formatSalaryRange(job.salaryMinK, job.salaryMaxK, job.salaryCurrency || 'USD')}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-emerald-700 whitespace-nowrap">
                      {job.match.overallScore}%
                    </td>
                    <td className="py-3.5 px-4">
                      <label htmlFor={`status-${job.id}`} className="sr-only">
                        Application status for {job.company}
                      </label>
                      <select
                        id={`status-${job.id}`}
                        value={record.status}
                        onChange={(e) =>
                          onUpdateStatus(
                            job.id,
                            e.target.value as ApplicationStatus
                          )
                        }
                        className="px-2.5 py-1 text-xs font-medium bg-slate-50 border border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                      >
                        <option value="Saved">Saved</option>
                        {record.status === 'Applied' && <option value="Applied" disabled>Applied</option>}
                        <option value="Interviewing">Interviewing</option>
                        <option value="Offer">Offer</option>
                        <option value="Archived">Archived</option>
                        <option value="Untracked">Remove</option>
                      </select>
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      {isEditing ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={nextStepInput}
                            onChange={(e) => setNextStepInput(e.target.value)}
                            placeholder="Next step (e.g. Tech screen Oct 24)"
                            aria-label="Next step"
                            className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded"
                          />
                          <textarea
                            rows={2}
                            value={noteInput}
                            onChange={(e) => setNoteInput(e.target.value)}
                            placeholder="Notes..."
                            aria-label="Application notes"
                            className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(job.id)}
                              className="px-2.5 py-1 text-xs font-semibold text-white bg-slate-900 rounded hover:bg-slate-800"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingJobId(null)}
                              className="px-2.5 py-1 text-xs text-slate-600 hover:text-slate-900"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          {record.nextStep && (
                            <div className="font-medium text-slate-800 mb-0.5">
                              Next: {record.nextStep}
                            </div>
                          )}
                          <div className="text-slate-600 line-clamp-2">
                            {record.notes || 'No notes recorded yet.'}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1">
                            {record.tailoredResumeDraft
                              ? 'Tailored Resume Ready'
                              : 'Base Resume'}{' '}
                            ·{' '}
                            {record.coverLetterDraft
                              ? 'Tailored Cover Letter Ready'
                              : 'No Cover Letter'}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(job.id, record)}
                            className="text-[11px] font-medium text-slate-500 hover:text-slate-900 underline mt-1"
                          >
                            Edit Notes
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenCoverLetter(job.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Tailor & Prepare</span>
                        </button>
                        {record.status === 'Saved' && <button type="button" onClick={() => onUpdateStatus(job.id, 'Applied')} className="rounded border px-2.5 py-1 text-xs">I submitted this</button>}
                        <a
                          href={job.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`View ${job.title} at ${job.company} on ${job.source}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0"
                        >
                          <span>{job.source}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
