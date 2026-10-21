import React, { useState } from 'react';
import { CandidateProfile, WorkMode } from '../types/career';
import { Plus, Trash2, Upload } from 'lucide-react';

interface PreferencesViewProps {
  profile: CandidateProfile;
  onUpdateProfile: (updated: CandidateProfile) => void;
  onResetDefaults: () => void;
}

const WORK_MODES: WorkMode[] = ['Remote', 'Hybrid', 'On-site'];

export const PreferencesView: React.FC<PreferencesViewProps> = ({
  profile,
  onUpdateProfile,
  onResetDefaults,
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

  const handleResumeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content =
        typeof reader.result === 'string' && reader.result.trim().length > 0
          ? reader.result
          : profile.baseResumeText;
      onUpdateProfile({
        ...profile,
        baseResumeFileName: file.name,
        baseResumeText: content,
      });
      triggerSaved(`Uploaded resume "${file.name}" for Resume Tailoring Agent`);
    };
    reader.readAsText(file);
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
            onClick={onResetDefaults}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            Reset Defaults
          </button>
        </div>
      </div>

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

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="pref-min-salary"
                  className="text-xs font-medium text-slate-700"
                >
                  Minimum Base Salary Target
                </label>
                <span className="text-sm font-bold text-slate-900 font-mono tabular-nums">
                  ${profile.minSalaryK}k / yr
                </span>
              </div>
              <input
                id="pref-min-salary"
                type="range"
                min={120}
                max={260}
                step={5}
                value={profile.minSalaryK}
                onChange={(e) => {
                  onUpdateProfile({
                    ...profile,
                    minSalaryK: Number(e.target.value),
                  });
                  triggerSaved();
                }}
                className="w-full accent-slate-900 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] font-mono tabular-nums text-slate-400 mt-1">
                <span>$120k</span>
                <span>$190k</span>
                <span>$260k</span>
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
