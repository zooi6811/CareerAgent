import { createHash } from 'node:crypto';

export type CompressedCandidateState = {
  version: 1;
  skills: string[];
  achievements: string[];
  headline: string;
  experienceYears?: number;
  bio: string;
  careerPreferences: Record<string, unknown>;
};

/** Holds only compact structured facts; source documents are never cached here. */
export class SharedState {
  private readonly candidates = new Map<string, CompressedCandidateState>();

  keyFor(candidate: Record<string, unknown>): string {
    const identity = [candidate.fullName, candidate.headline, candidate.skills, candidate.keyAchievements]
      .map((value) => JSON.stringify(value ?? ''))
      .join('|');
    return createHash('sha256').update(identity).digest('hex');
  }

  rememberCandidate(candidate: Record<string, unknown>, state: CompressedCandidateState): void {
    const key = this.keyFor(candidate);
    this.candidates.delete(key);
    this.candidates.set(key, state);
    while (this.candidates.size > 100) this.candidates.delete(this.candidates.keys().next().value!);
  }

  candidate(candidate: Record<string, unknown>): CompressedCandidateState {
    const key = this.keyFor(candidate);
    const cached = this.candidates.get(key);
    if (cached) return cached;
    const blueprint = (candidate.consultationBlueprint || {}) as Record<string, unknown>;
    const state: CompressedCandidateState = {
      version: 1,
      skills: stringList(candidate.skills, 24),
      achievements: stringList(candidate.keyAchievements, 12),
      headline: shortText(candidate.headline, 240),
      experienceYears: finiteNumber(candidate.yearsExperience),
      bio: shortText(candidate.bioSummary, 1200),
      careerPreferences: pick(blueprint, [
        'recommendedRoles', 'targetLocations', 'preferredCountry', 'salaryCurrency',
        'minSalaryK', 'preferredWorkModes', 'workEnvironment', 'progressionGoal',
      ]),
    };
    return state;
  }
}

function stringList(value: unknown, limit: number): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string').slice(0, limit).map((entry) => entry.slice(0, 240)) : [];
}
function shortText(value: unknown, limit: number): string { return typeof value === 'string' ? value.trim().slice(0, limit) : ''; }
function finiteNumber(value: unknown): number | undefined { return typeof value === 'number' && Number.isFinite(value) ? value : undefined; }
function pick(source: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  return Object.fromEntries(keys.filter((key) => source[key] !== undefined && source[key] !== null && source[key] !== '').map((key) => [key, source[key]]));
}

export const sharedState = new SharedState();

