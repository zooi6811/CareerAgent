export interface AgentErrorPayload {
  error: string;
  code: string;
  status: number;
}

export class AgentClientError extends Error {
  code: string;
  status: number;

  constructor(payload: AgentErrorPayload) {
    super(payload.error);
    this.name = 'AgentClientError';
    this.code = payload.code;
    this.status = payload.status;
  }
}

export function formatAgentError(err: unknown): string {
  if (err instanceof AgentClientError) {
    if (err.status === 429 || err.code === 'rate_limited') {
      return 'Rate limited, retry in a minute';
    }
    if (err.code === 'missing_api_key' || err.code === 'invalid_api_key') {
      return err.message;
    }
    if (err.code === 'no_results') {
      return err.message;
    }
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return 'Something went wrong. Try again.';
}

export async function agentFetch<T>(
  url: string,
  body: unknown
): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) {
    const payload = (data || {}) as { error?: string; code?: string };
    throw new AgentClientError({
      error: payload.error || `Request failed (${response.status})`,
      code: payload.code || 'request_failed',
      status: response.status,
    });
  }
  return data as T;
}

export function mergeJobFeeds<T extends { id: string }>(
  incoming: T[],
  previous: T[],
  cap = 100
): T[] {
  const map = new Map<string, T>();
  for (const job of [...incoming, ...previous]) {
    if (!map.has(job.id)) {
      map.set(job.id, job);
    }
  }
  return Array.from(map.values()).slice(0, cap);
}

export function defaultNextStep(status: string): string {
  switch (status) {
    case 'Saved':
      return 'Review tailored resume and cover letter, then prepare the application';
    case 'Applied':
      return 'Follow up with the hiring team in 5 business days';
    case 'Interviewing':
      return 'Prepare for the next interview';
    case 'Offer':
      return 'Review compensation, timeline, and written offer';
    default:
      return '';
  }
}

export function formatAppliedAt(date = new Date()): string {
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
