import React, { useEffect, useState } from 'react';
import type { ApplicationRecord, ApplicationStatus, CandidateProfile, CoverLetterMessage, ScoredJobListing } from '../types/career';
import { formatSalaryRange, generateTailoredResumeText } from '../utils/jobScoring';
import { ingestResumeFile } from '../utils/resumeIngest';
import { Upload } from 'lucide-react';

interface Props {
  jobs: ScoredJobListing[];
  selectedJob?: ScoredJobListing;
  onSelectJob: (id: string) => void;
  profile: CandidateProfile;
  onUploadBaseResume: (name: string, text: string) => void;
  applicationRecord?: ApplicationRecord;
  onSavePackageAndStatus: (id: string, resume: string, letter: string, status?: ApplicationStatus, extras?: { fitRationale?: string }) => void;
  chatMessages: CoverLetterMessage[];
  onSendChatPrompt: (job: ScoredJobListing, instruction: string, tone: string, letter: string, resume: string, target: 'resume' | 'cover-letter') => Promise<{updatedDraft?: string; targetDoc?: 'resume' | 'cover-letter'}>;
  onTailorBothDocuments: (job: ScoredJobListing, tone: string) => Promise<{tailoredResume: string; coverLetter: string; agentSummary: string; fitRationale?: string} | null>;
  onPrepareApplication: (job: ScoredJobListing, resume: string, letter: string) => Promise<{message: string; pipelineLog: string[]; sourceUrl: string} | null>;
  onMarkSubmitted: (id: string) => void;
  isGenerating: boolean;
  onReportError: (err: unknown) => void;
}

export const CoverLetterStudio: React.FC<Props> = (props) => {
  const { jobs, selectedJob, onSelectJob, profile, onUploadBaseResume, applicationRecord, onSavePackageAndStatus, chatMessages, onSendChatPrompt, onTailorBothDocuments, onPrepareApplication, onMarkSubmitted, isGenerating, onReportError } = props;
  const [resume, setResume] = useState('');
  const [letter, setLetter] = useState('');
  const [instruction, setInstruction] = useState('');
  const [tab, setTab] = useState<'resume'|'letter'|'base'>('resume');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!selectedJob) { setResume(''); setLetter(''); return; }
    setResume(applicationRecord?.tailoredResumeDraft || generateTailoredResumeText(selectedJob, profile));
    setLetter(applicationRecord?.coverLetterDraft || '');
  }, [selectedJob?.id, applicationRecord?.tailoredResumeDraft, applicationRecord?.coverLetterDraft]);

  if (!selectedJob) return <section className="max-w-[1380px] mx-auto px-6 py-8"><h1 className="text-2xl font-bold">Application Studio</h1><p className="mt-3 text-slate-600">Find a verified job posting before tailoring an application.</p></section>;

  const save = (status?: ApplicationStatus) => onSavePackageAndStatus(selectedJob.id, resume, letter, status);
  const prepare = async () => {
    const result = await onPrepareApplication(selectedJob, resume, letter);
    if (result) setNotice('Package exported and posting opened. Submit on the job board, then mark it Applied here.');
  };
  const tailor = async () => {
    const result = await onTailorBothDocuments(selectedJob, 'Clear and factual');
    if (result) { setResume(result.tailoredResume); setLetter(result.coverLetter); save('Saved'); setNotice(result.agentSummary); }
  };
  const refine = async () => {
    if (!instruction.trim()) return;
    setBusy(true);
    try {
      const result = await onSendChatPrompt(selectedJob, instruction, 'Clear and factual', letter, resume, tab === 'resume' ? 'resume' : 'cover-letter');
      if (result.updatedDraft) result.targetDoc === 'resume' ? setResume(result.updatedDraft) : setLetter(result.updatedDraft);
      setInstruction('');
    } catch (err) { onReportError(err); } finally { setBusy(false); }
  };
  const upload = async (file?: File) => {
    if (!file) return;
    try { const parsed = await ingestResumeFile(file); onUploadBaseResume(parsed.fileName, parsed.text); setNotice(`Loaded ${parsed.fileName}.`); }
    catch (err) { onReportError(err); }
  };
  const text = tab === 'resume' ? resume : tab === 'letter' ? letter : profile.baseResumeText;

  return <section className="max-w-[1380px] mx-auto px-6 py-6 space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-5"><div><p className="text-xs text-slate-500">Resume tailoring · Cover letter · Application preparation</p><h1 className="text-2xl font-bold">Prepare your application</h1></div><select aria-label="Target job" value={selectedJob.id} onChange={e=>onSelectJob(e.target.value)} className="rounded border px-3 py-2">{jobs.map(j=><option key={j.id} value={j.id}>{j.company} — {j.title}</option>)}</select></header>
    {notice && <div role="status" className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm">{notice}</div>}
    <div className="rounded border bg-white p-4"><strong>{selectedJob.title} · {selectedJob.company}</strong><p className="text-sm text-slate-600">{selectedJob.location} · {selectedJob.workMode} · {formatSalaryRange(selectedJob.salaryMinK, selectedJob.salaryMaxK, selectedJob.salaryCurrency || profile.salaryCurrency)} · {selectedJob.source}</p><p className="text-sm mt-2">{selectedJob.match.matchedSkills.length ? `Your profile lists ${selectedJob.match.matchedSkills.join(', ')} among the posting skills.` : 'No exact skills overlap was found in your current profile.'}{selectedJob.match.missingSkills.length > 0 && ` Gaps: ${selectedJob.match.missingSkills.slice(0,5).join(', ')}.`}</p></div>
    <div className="flex flex-wrap gap-2">{(['resume','letter','base'] as const).map(t=><button key={t} onClick={()=>setTab(t)} className={`rounded px-3 py-2 text-sm ${tab===t?'bg-slate-900 text-white':'bg-slate-100'}`}>{t==='resume'?'Tailored resume':t==='letter'?'Cover letter':'Base resume'}</button>)}<label className="cursor-pointer rounded bg-slate-100 px-3 py-2 text-sm"><Upload className="inline h-4 w-4"/> Upload resume<input className="sr-only" type="file" accept=".pdf,.docx,.txt,.md" onChange={e=>{void upload(e.target.files?.[0]);e.target.value='';}} /></label></div>
    <textarea aria-label="Application document" value={text} onChange={e=>tab==='resume'?setResume(e.target.value):tab==='letter'?setLetter(e.target.value):onUploadBaseResume(profile.baseResumeFileName,e.target.value)} onBlur={()=>{if(tab!=='base') save();}} rows={18} className="w-full rounded-lg border bg-white p-4 text-sm leading-relaxed" />
    <div className="flex flex-wrap gap-2"><button disabled={isGenerating} onClick={()=>void tailor()} className="rounded bg-slate-900 px-4 py-2 text-sm text-white">{isGenerating?'Tailoring…':'Generate tailored package'}</button><button onClick={()=>save('Saved')} className="rounded bg-slate-100 px-4 py-2 text-sm">Save package</button><button disabled={!letter.trim()||!resume.trim()} onClick={()=>void prepare()} className="rounded bg-emerald-700 px-4 py-2 text-sm text-white">Prepare &amp; open application</button>{applicationRecord?.status==='Saved'&&<button onClick={()=>onMarkSubmitted(selectedJob.id)} className="rounded border px-4 py-2 text-sm">I submitted this</button>}</div>
    <div className="flex gap-2"><input value={instruction} onChange={e=>setInstruction(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void refine();}} placeholder={`Refine the ${tab==='resume'?'resume':'cover letter'}`} className="flex-1 rounded border px-3 py-2"/><button disabled={busy||isGenerating||!instruction.trim()} onClick={()=>void refine()} className="rounded bg-slate-800 px-4 py-2 text-sm text-white">Refine</button></div>
    <div className="space-y-2">{chatMessages.map(m=><p key={m.id} className="rounded bg-slate-100 p-3 text-sm">{m.content}</p>)}</div>
    {applicationRecord?.fitRationale&&<aside className="rounded border p-3 text-sm"><strong>AI-generated fit analysis</strong><p>{applicationRecord.fitRationale}</p></aside>}
  </section>;
};

