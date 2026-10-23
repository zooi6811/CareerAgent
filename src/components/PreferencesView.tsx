import React, { useState } from 'react';
import { AgentMemory, CandidateProfile, WorkMode } from '../types/career';
import { Database, Plus, Trash2, Upload } from 'lucide-react';
import { ingestResumeFile } from '../utils/resumeIngest';
import { formatAgentError } from '../utils/agentApi';
import { COUNTRY_OPTIONS, currencyForCountry, formatAnnualSalary, salaryCeiling, timeZoneForCountry } from '../utils/localePreferences';

interface PreferencesViewProps {
  profile: CandidateProfile;
  onUpdateProfile: (updated: CandidateProfile) => void;
  onResetDefaults: () => void;
  onLoadDemoData: () => void;
  onReportError: (error: unknown) => void;
  agentMemory: AgentMemory;
  lastSessionAt?: string;
  onSaveData: () => void;
  onResetAllData: () => void;
}

const WORK_MODES: WorkMode[] = ['Remote', 'Hybrid', 'On-site'];

export const PreferencesView: React.FC<PreferencesViewProps> = ({
  profile,
  onUpdateProfile,
  onResetDefaults,
  onLoadDemoData,
  onReportError,
  agentMemory,
  lastSessionAt,
  onSaveData,
  onResetAllData,
}) => {
  const [newSkill, setNewSkill] = useState<string>('');
  const [newRole, setNewRole] = useState<string>('');
  const [newAchievement, setNewAchievement] = useState<string>('');
  const [skillError, setSkillError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const triggerSaved = (msg = 'Preferences updated · Feed scores recalculated') => {
    setSavedNotice(msg);
    setTimeout(() => setSavedNotice(null), 3000);
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = await ingestResumeFile(file);
      onUpdateProfile({
        ...profile,
        baseResumeFileName: parsed.fileName,
        baseResumeText: parsed.text,
      });
      triggerSaved(`Uploaded resume "${file.name}" for Resume Tailoring Agent`);
    } catch (error) {
      onReportError(error);
      triggerSaved(formatAgentError(error));
    }
  };

  const handleAddSkill = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newSkill.trim();
    if (!trimmed) {
      setSkillError('Please enter a skill name before adding.');
      return;
    }
    if (
      profile.skills.some((s) => s.toLowerCase() === trimmed.toLowerCase())
    ) {
      setSkillError('This skill is already in your profile.');
      return;
    }
    setSkillError(null);
    onUpdateProfile({
      ...profile,
      skills: [...profile.skills, trimmed],
    });
    setNewSkill('');
    triggerSaved();
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    onUpdateProfile({
      ...profile,
      skills: profile.skills.filter((s) => s !== skillToRemove),
    });
    triggerSaved();
  };

  const handleAddRole = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newRole.trim();
    if (!trimmed) return;
    if (!profile.targetRoles.includes(trimmed)) {
      onUpdateProfile({
        ...profile,
        targetRoles: [...profile.targetRoles, trimmed],
      });
      setNewRole('');
      triggerSaved();
    }
  };

  const handleRemoveRole = (roleToRemove: string) => {
    onUpdateProfile({
      ...profile,
      targetRoles: profile.targetRoles.filter((r) => r !== roleToRemove),
    });
    triggerSaved();
  };

  const handleToggleWorkMode = (mode: WorkMode) => {
    const exists = profile.preferredWorkModes.includes(mode);
    const nextModes = exists
      ? profile.preferredWorkModes.filter((m) => m !== mode)
      : [...profile.preferredWorkModes, mode];
    if (nextModes.length === 0) return;
    onUpdateProfile({
      ...profile,
      preferredWorkModes: nextModes,
    });
    triggerSaved();
  };

  const handleAddAchievement = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newAchievement.trim();
    if (!trimmed) return;
    onUpdateProfile({
      ...profile,
      keyAchievements: [...profile.keyAchievements, trimmed],
    });
    setNewAchievement('');
    triggerSaved();
  };

  return (
    <section className="max-w-[1220px] mx-auto px-6 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 mb-6 border-b border-slate-200">
        <div>
          <p className="text-xs text-slate-500 mb-1">
            Uploaded Resume Foundation & Agent Ranking Weights
          </p>
          <h1 className="text-2xl font-bold text-slate-900 font-display">
            Candidate Profile, Base Resume & Preferences
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {savedNotice && (
            <span
              role="status"
              className="text-xs font-medium text-emerald-700"
            >
              {savedNotice}
            </span>
          )}
          <button
            type="button"
            onClick={() => { onSaveData(); triggerSaved('Profile, memory, jobs, and applications saved on this device.'); }}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800"
          >Save now</button>
          <button
            type="button"
            onClick={onResetDefaults}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            Reset profile defaults
          </button>
        </div>
      </div>

      <section className="mb-6 rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-start gap-3">
          <Database className="mt-0.5 h-5 w-5 text-slate-700" />
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-slate-900">Agent memory & saved data</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">Your resume, preferences, jobs, applications, consultant conversations, and compact agent memory are saved automatically in this browser. They are not synced to an account. Anyone with access to this browser profile may be able to view this data.</p>
            <p className="mt-2 text-xs text-slate-500">Memory has three parts: career facts and preferences, recent session episodes, and your instructions for how agents should work. A local reflection step updates these after changes without making an extra model call.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <div className="rounded bg-slate-50 p-3"><strong className="text-xs">Semantic memory</strong><p className="mt-1 line-clamp-4 whitespace-pre-line text-[11px] text-slate-600">{agentMemory.semantic || 'Add profile details and work preferences to build this memory.'}</p></div>
              <div className="rounded bg-slate-50 p-3"><strong className="text-xs">Recent episodes</strong><p className="mt-1 text-[11px] text-slate-600">{agentMemory.episodic.length} remembered events</p><p className="mt-1 text-[11px] text-slate-500">{agentMemory.episodic[0]?.summary || 'Consultations, resume analysis, and job searches appear here.'}</p></div>
              <div className="rounded bg-slate-50 p-3"><strong className="text-xs">Procedural memory</strong><p className="mt-1 text-[11px] text-slate-600">{agentMemory.procedural.length} saved instructions</p><p className="mt-1 text-[11px] text-slate-500">{lastSessionAt ? `Last opened ${new Date(lastSessionAt).toLocaleString()}` : 'This is the first saved session.'}</p></div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
              <button type="button" onClick={() => { if (window.confirm('Delete your saved resume, profile, preferences, applications, jobs, conversation history, and agent memory from this browser? This cannot be undone.')) onResetAllData(); }} className="inline-flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5"/>Reset all saved data</button>
              <span className="text-[11px] text-slate-500">The app opens to Daily Feed next time. Your last activity summary is shown there.</span>
            </div>
          </div>
        </div>
      </section>

      {/* Uploaded Base Resume Card (Used by Resume Tailoring Agent) */}
      <div className="p-5 mb-6 bg-white border border-slate-200 rounded-lg space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Uploaded Base Resume ({profile.baseResumeFileName})
            </h2>
            <p className="text-xs text-slate-500">
              When you select a job to apply for, the Resume Tailoring Agent uses this existing resume as the source foundation to draft a role-specific resume.
            </p>
          </div>
          <label className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 cursor-pointer transition-colors whitespace-nowrap shrink-0">
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Resume File</span>
            <input
              type="file"
              accept=".txt,.md,.pdf,.doc,.docx,.json"
              onChange={handleResumeUpload}
              className="sr-only"
            />
          </label>
        </div>

        <label htmlFor="base-resume-textarea" className="sr-only">
          Base Resume Content
        </label>
        <textarea
          id="base-resume-textarea"
          rows={7}
          value={profile.baseResumeText}
          onChange={(e) =>
            onUpdateProfile({ ...profile, baseResumeText: e.target.value })
          }
          className="w-full p-3 text-xs leading-relaxed font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:bg-white focus:ring-2 focus:ring-slate-900"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Compensation, Work Modes & Core Identity */}
        <div className="lg:col-span-6 space-y-6">
          <div className="p-5 bg-white border border-slate-200 rounded-lg space-y-4">
            <h2 className="text-base font-semibold text-slate-900">
              Compensation & Work Mode Priorities
            </h2>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <h3 className="text-xs font-semibold text-slate-800">Your work location</h3>
              <p className="mt-1 text-[11px] text-slate-500">Salary and job search context use this market. Your time zone is prefilled and editable.</p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium text-slate-700">Country or market
                  <input list="preferences-country-options" value={profile.preferredCountry || ''} onChange={e=>{
                    const country=e.target.value; const currency=currencyForCountry(country); const timeZone=timeZoneForCountry(country);
                    onUpdateProfile({...profile,preferredCountry:country,...(currency?{salaryCurrency:currency}:{}),...(timeZone?{timeZone}:{}),minSalaryK:0,consultationBlueprint:{...profile.consultationBlueprint,preferredCountry:country,...(currency?{salaryCurrency:currency}:{}),...(timeZone?{timeZone}:{}),minSalaryK:0}}); triggerSaved('Location market updated');
                  }} placeholder="Choose or type a country" className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs" />
                  <datalist id="preferences-country-options">{COUNTRY_OPTIONS.map(([code,name])=><option key={code} value={name}/>)}</datalist>
                </label>
                <label className="text-xs font-medium text-slate-700">Salary currency
                  <input maxLength={3} value={profile.salaryCurrency || 'USD'} onChange={e=>onUpdateProfile({...profile,salaryCurrency:e.target.value.toUpperCase(),minSalaryK:0,consultationBlueprint:{...profile.consultationBlueprint,salaryCurrency:e.target.value.toUpperCase(),minSalaryK:0}})} placeholder="e.g. MYR" className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs uppercase" />
                </label>
                <label className="text-xs font-medium text-slate-700">Time zone
                  <input value={profile.timeZone || 'UTC'} onChange={e=>onUpdateProfile({...profile,timeZone:e.target.value,consultationBlueprint:{...profile.consultationBlueprint,timeZone:e.target.value}})} placeholder="e.g. Asia/Kuala_Lumpur" className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs" />
                </label>
                <label className="text-xs font-medium text-slate-700">Where are you based?
                  <input value={profile.homeLocation || ''} onChange={e=>onUpdateProfile({...profile,homeLocation:e.target.value,consultationBlueprint:{...profile.consultationBlueprint,homeLocation:e.target.value}})} placeholder="Your city or area, e.g. Petaling Jaya, Selangor" autoComplete="address-level2" className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs" />
                  <span className={`mt-1 block text-[10px] font-normal ${profile.homeLocation ? 'text-slate-500' : 'text-amber-700'}`}>{profile.homeLocation ? 'Commute fit uses this as your starting point. Your desired job locations are set separately.' : 'Add your city or area to personalize commute fit. Until then, location scoring stays neutral.'}</span>
                </label>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="pref-min-salary"
                  className="text-xs font-medium text-slate-700"
                >
                  Minimum Annual Base Salary ({profile.salaryCurrency || 'USD'})
                </label>
                <span className="text-sm font-bold text-slate-900 font-mono tabular-nums">
                  {formatAnnualSalary(profile.minSalaryK,profile.salaryCurrency || 'USD')} / yr
                </span>
              </div>
              <input
                id="pref-min-salary"
                type="range"
                min={0}
                max={salaryCeiling(profile.salaryCurrency)}
                step={salaryCeiling(profile.salaryCurrency) > 1000 ? 100 : 5}
                value={profile.minSalaryK}
                onChange={(e) => {
                  const salary = Number(e.target.value);
                  onUpdateProfile({
                    ...profile,
                    minSalaryK: salary,
                    consultationBlueprint: { ...profile.consultationBlueprint, minSalaryK: salary },
                  });
                  triggerSaved();
                }}
                className="w-full accent-slate-900 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] font-mono tabular-nums text-slate-400 mt-1">
                <span>{profile.salaryCurrency} 0</span>
                <span>{profile.salaryCurrency} {Math.round(salaryCeiling(profile.salaryCurrency)/2)}k</span>
                <span>{profile.salaryCurrency} {salaryCeiling(profile.salaryCurrency)}k</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <p className="text-xs font-medium text-slate-700 mb-2">
                Preferred Work Modes
              </p>
              <div className="flex items-center gap-2">
                {WORK_MODES.map((mode) => {
                  const active = profile.preferredWorkModes.includes(mode);
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => handleToggleWorkMode(mode)}
                      aria-pressed={active}
                      className={`px-3.5 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-600 border-slate-300 hover:text-slate-900'
                      }`}
                    >
                      {mode}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="p-5 bg-white border border-slate-200 rounded-lg space-y-4">
            <h2 className="text-base font-semibold text-slate-900">
              Candidate Profile & Bio
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="pref-fullname"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Full Name
                </label>
                <input
                  id="pref-fullname"
                  type="text"
                  value={profile.fullName}
                  onChange={(e) =>
                    onUpdateProfile({ ...profile, fullName: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label
                  htmlFor="pref-years"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Years of Experience
                </label>
                <input
                  id="pref-years"
                  type="number"
                  min={1}
                  max={40}
                  value={profile.yearsExperience}
                  onChange={(e) =>
                    onUpdateProfile({
                      ...profile,
                      yearsExperience: Number(e.target.value) || 1,
                    })
                  }
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="pref-headline"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Professional Headline
              </label>
              <input
                id="pref-headline"
                type="text"
                value={profile.headline}
                onChange={(e) =>
                  onUpdateProfile({ ...profile, headline: e.target.value })
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label
                htmlFor="pref-bio"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Executive Bio Summary
              </label>
              <textarea
                id="pref-bio"
                rows={3}
                value={profile.bioSummary}
                onChange={(e) =>
                  onUpdateProfile({ ...profile, bioSummary: e.target.value })
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label htmlFor="pref-personality" className="block text-xs font-medium text-slate-700 mb-1">Personality & work style (optional)</label>
              <textarea id="pref-personality" rows={3} value={profile.personalityNotes || ''} onChange={(e) => onUpdateProfile({ ...profile, personalityNotes: e.target.value })} placeholder="For example: I prefer collaborative teams, thoughtful feedback, and time to focus." className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label htmlFor="pref-agent-instructions" className="block text-xs font-medium text-slate-700 mb-1">Instructions for your agents</label>
              <textarea id="pref-agent-instructions" rows={3} value={profile.agentInstructions || ''} onChange={(e) => onUpdateProfile({ ...profile, agentInstructions: e.target.value })} placeholder="For example: Keep recommendations concise and never assume a salary currency." className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
            </div>
          </div>
        </div>

        {/* Right Column: Technical Skills, Target Roles & Achievements */}
        <div className="lg:col-span-6 space-y-6">
          <div className="p-5 bg-white border border-slate-200 rounded-lg space-y-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Core Technical Skills ({profile.skills.length})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Skills carry a 50% weight in your daily feed priority ranking.
              </p>
            </div>

            <form onSubmit={handleAddSkill} className="flex items-center gap-2">
              <label htmlFor="add-skill-input" className="sr-only">
                Add a technical skill
              </label>
              <input
                id="add-skill-input"
                type="text"
                value={newSkill}
                onChange={(e) => {
                  setNewSkill(e.target.value);
                  if (skillError) setSkillError(null);
                }}
                placeholder="Add skill (e.g. Kubernetes, Rust, PyTorch)..."
                className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Skill</span>
              </button>
            </form>

            {skillError && (
              <p role="alert" className="text-xs text-red-600 font-medium">
                {skillError}
              </p>
            )}

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
              {profile.skills.map((skill) => (
                <div
                  key={skill}
                  className="flex items-center justify-between px-3.5 py-2 text-xs"
                >
                  <span className="font-medium text-slate-800">{skill}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveSkill(skill)}
                    aria-label={`Remove skill ${skill}`}
                    className="text-slate-400 hover:text-red-600 transition-colors p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="p-5 bg-white border border-slate-200 rounded-lg space-y-4">
            <h2 className="text-base font-semibold text-slate-900">
              Target Job Titles
            </h2>

            <form onSubmit={handleAddRole} className="flex items-center gap-2">
              <label htmlFor="add-role-input" className="sr-only">
                Add target job title
              </label>
              <input
                id="add-role-input"
                type="text"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                placeholder="Add target role (e.g. Engineering Manager)..."
                className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                Add Role
              </button>
            </form>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
              {profile.targetRoles.map((role) => (
                <div
                  key={role}
                  className="flex items-center justify-between px-3.5 py-2 text-xs"
                >
                  <span className="font-medium text-slate-800">{role}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveRole(role)}
                    aria-label={`Remove target role ${role}`}
                    className="text-slate-400 hover:text-red-600 transition-colors p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="p-5 bg-white border border-slate-200 rounded-lg space-y-4">
            <h2 className="text-base font-semibold text-slate-900">
              Quantified Achievements (For Resume & Cover Letter Grounding)
            </h2>
            <ul className="space-y-2 text-xs text-slate-700 list-disc pl-4">
              {profile.keyAchievements.map((ach, idx) => (
                <li key={idx} className="leading-relaxed">
                  {ach}
                </li>
              ))}
            </ul>
            <form
              onSubmit={handleAddAchievement}
              className="flex items-center gap-2 pt-2"
            >
              <label htmlFor="add-achievement-input" className="sr-only">
                Add quantified achievement
              </label>
              <input
                id="add-achievement-input"
                type="text"
                value={newAchievement}
                onChange={(e) => setNewAchievement(e.target.value)}
                placeholder="Add quantified achievement..."
                className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
              <button
                type="submit"
                className="px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap shrink-0"
              >
                Add Bullet
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
};
