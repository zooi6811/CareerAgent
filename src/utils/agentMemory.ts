import type { AgentMemory, CandidateProfile } from '../types/career';

export const EMPTY_AGENT_MEMORY: AgentMemory = { semantic: '', episodic: [], procedural: [] };

function compact(values: Array<string | undefined>, max = 8): string {
  return values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)).slice(0, max).join(', ');
}

export function reflectAgentMemory(
  profile: CandidateProfile,
  previous: AgentMemory,
  episode?: string,
  userInstruction?: string,
): AgentMemory {
  const blueprint = profile.consultationBlueprint;
  const facts = [
    profile.headline && `Career: ${profile.headline}${profile.yearsExperience ? `, ${profile.yearsExperience} years` : ''}`,
    profile.skills.length && `Skills: ${compact(profile.skills, 12)}`,
    profile.targetRoles.length && `Target roles: ${compact(profile.targetRoles)}`,
    blueprint.corePassions.length && `Interests: ${compact(blueprint.corePassions, 6)}`,
    blueprint.preferredCountry && `Market: ${blueprint.preferredCountry}${blueprint.homeLocation ? `; home base ${blueprint.homeLocation}` : ''}`,
    blueprint.targetLocations.length && `Work locations: ${compact(blueprint.targetLocations, 6)}`,
    blueprint.preferredWorkModes.length && `Work modes: ${compact(blueprint.preferredWorkModes)}`,
    blueprint.minSalaryK > 0 && `Minimum annual base: ${blueprint.salaryCurrency || profile.salaryCurrency || ''} ${blueprint.minSalaryK}k`,
    blueprint.maxCommuteMinutes !== undefined && `Commute limit: ${blueprint.maxCommuteMinutes} minutes`,
    blueprint.workLifeBalancePriority && `Work-life balance: ${blueprint.workLifeBalancePriority}`,
    blueprint.jobSecurityPriority && `Job security: ${blueprint.jobSecurityPriority}`,
    blueprint.progressionGoal && `Progression: ${blueprint.progressionGoal}`,
    profile.personalityNotes?.trim() && `Personality and work style (user-described): ${profile.personalityNotes.trim().slice(0, 500)}`,
  ].filter(Boolean).join('\n');

  const procedural = [...previous.procedural];
  if (profile.agentInstructions?.trim()) procedural.unshift(profile.agentInstructions.trim().slice(0, 300));
  if (userInstruction?.trim() && /\b(always|please|prefer|don't|do not|never|keep|avoid)\b/i.test(userInstruction)) {
    const instruction = userInstruction.trim().slice(0, 240);
    if (!procedural.some((item) => item.toLowerCase() === instruction.toLowerCase())) procedural.unshift(instruction);
  }
  const nextEpisode = episode?.trim() ? [{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, at: new Date().toISOString(), summary: episode.trim().slice(0, 320) }, ...previous.episodic] : previous.episodic;

  return {
    semantic: facts.slice(0, 2200),
    episodic: nextEpisode.slice(0, 16),
    procedural: [...new Set(procedural)].slice(0, 8),
    reflectedAt: new Date().toISOString(),
  };
}

export function memoryForAgent(memory: AgentMemory) {
  return {
    semantic: memory.semantic.slice(0, 2200),
    recentEpisodes: memory.episodic.slice(0, 3).map((episode) => episode.summary),
    procedural: memory.procedural.slice(0, 6),
  };
}
