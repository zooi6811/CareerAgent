import type { ModelProvider } from './gemini.ts';

type Reservation = { at: number; tokens: number };
type ProviderLimits = { requestsPerMinute: number; tokensPerMinute: number };
export type ObservedProviderLimits = {
  limitRequests?: number; remainingRequests?: number; resetRequestsMs?: number;
  limitTokens?: number; remainingTokens?: number; resetTokensMs?: number;
};

// Conservative local ceilings leave room for provider-side accounting differences.
const LIMITS: Record<ModelProvider, ProviderLimits> = {
  gemini: { requestsPerMinute: 9, tokensPerMinute: 220_000 },
  // Conservative cold-start ceiling for common Groq free-tier model limits;
  // observed provider headers can lower this further for the active account.
  groq: { requestsPerMinute: 25, tokensPerMinute: 7_000 },
  openrouter: { requestsPerMinute: 5, tokensPerMinute: 20_000 },
};
const WINDOW_MS = 60_000;

class ProviderQueue {
  private tail: Promise<void> = Promise.resolve();
  private reservations: Reservation[] = [];
  private generation = 0;
  private cancelWaiters = new Set<() => void>();
  private observed: ObservedProviderLimits | null = null;
  private observedAt = 0;

  constructor(private readonly provider: ModelProvider, private readonly limits: ProviderLimits) {}

  run<T>(task: () => Promise<T>, estimatedTokens: number): Promise<T> {
    const tokenBudget = this.tokenBudget();
    if (estimatedTokens > tokenBudget) {
      return Promise.reject(new Error(`${this.provider} request is estimated at ${estimatedTokens} tokens, above the safe ${tokenBudget} token-per-minute request budget. Compress the input or choose a provider with a larger current limit.`));
    }
    const generation = this.generation;
    const result = this.tail.then(async () => {
      await this.waitForCapacity(estimatedTokens, generation);
      if (generation !== this.generation) throw new Error('Request cancelled while waiting in provider queue.');
      this.reservations.push({ at: Date.now(), tokens: estimatedTokens });
      return task();
    });
    this.tail = result.then(() => undefined, () => undefined);
    return result;
  }

  cancelPending(): void {
    this.generation++;
    for (const cancel of this.cancelWaiters) cancel();
    this.cancelWaiters.clear();
  }

  observe(limits: ObservedProviderLimits): void {
    this.observed = { ...this.observed, ...limits };
    this.observedAt = Date.now();
  }

  private requestBudget(): number {
    return Math.max(1, Math.floor(Math.min(this.limits.requestsPerMinute, (this.observed?.limitRequests ?? Infinity) * 0.9)));
  }

  private tokenBudget(): number {
    return Math.max(1, Math.floor(Math.min(this.limits.tokensPerMinute, (this.observed?.limitTokens ?? Infinity) * 0.9)));
  }

  budget(): number { return this.tokenBudget(); }

  private async waitForCapacity(tokens: number, generation: number): Promise<void> {
    while (generation === this.generation) {
      const now = Date.now();
      this.reservations = this.reservations.filter((entry) => now - entry.at < WINDOW_MS);
      const requestWait = this.reservations.length >= this.requestBudget()
        ? Math.max(1, this.reservations[0].at + WINDOW_MS - now)
        : 0;
      const totalTokens = this.reservations.reduce((sum, entry) => sum + entry.tokens, 0);
      let tokenWait = 0;
      if (totalTokens + tokens > this.limits.tokensPerMinute) {
        let remaining = totalTokens;
        for (const entry of this.reservations) {
          remaining -= entry.tokens;
          if (remaining + tokens <= this.limits.tokensPerMinute) {
            tokenWait = Math.max(1, entry.at + WINDOW_MS - now);
            break;
          }
        }
      }
      const sinceObserved = this.reservations.filter((entry) => entry.at >= this.observedAt);
      const requestsAfterObserved = sinceObserved.length;
      const tokensAfterObserved = sinceObserved.reduce((sum, entry) => sum + entry.tokens, 0);
      let observedRequestWait = 0;
      let observedTokenWait = 0;
      if (this.observed && now - this.observedAt < WINDOW_MS) {
        const requestResetAt = this.observedAt + (this.observed.resetRequestsMs || WINDOW_MS);
        const tokenResetAt = this.observedAt + (this.observed.resetTokensMs || WINDOW_MS);
        const remainingRequests = now >= requestResetAt ? this.observed.limitRequests : this.observed.remainingRequests;
        const remainingTokens = now >= tokenResetAt ? this.observed.limitTokens : this.observed.remainingTokens;
        if (typeof remainingRequests === 'number' && remainingRequests - requestsAfterObserved < 1) {
          observedRequestWait = Math.max(1, requestResetAt - now);
        }
        if (typeof remainingTokens === 'number' && remainingTokens - tokensAfterObserved < tokens) {
          observedTokenWait = Math.max(1, tokenResetAt - now);
        }
      }
      const waitMs = Math.max(requestWait, tokenWait, observedRequestWait, observedTokenWait);
      if (waitMs <= 0) return;
      await new Promise<void>((resolve) => {
        const cancel = () => { clearTimeout(timer); this.cancelWaiters.delete(cancel); resolve(); };
        const timer = setTimeout(() => { this.cancelWaiters.delete(cancel); resolve(); }, waitMs);
        this.cancelWaiters.add(cancel);
      });
    }
  }
}

const queues: Record<ModelProvider, ProviderQueue> = {
  gemini: new ProviderQueue('gemini', LIMITS.gemini),
  groq: new ProviderQueue('groq', LIMITS.groq),
  openrouter: new ProviderQueue('openrouter', LIMITS.openrouter),
};

export function runProviderRequest<T>(provider: ModelProvider, estimatedTokens: number, task: () => Promise<T>): Promise<T> {
  return queues[provider].run(task, estimatedTokens);
}

export function observeProviderLimits(provider: ModelProvider, limits: ObservedProviderLimits): void {
  queues[provider].observe(limits);
}

export function getProviderTokenBudget(provider: ModelProvider): number { return queues[provider].budget(); }

export function parseProviderDuration(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const parts = [...value.matchAll(/([\d.]+)\s*(ms|s|sec|m|min|h)/gi)];
  if (!parts.length) return undefined;
  return parts.reduce((sum, part) => {
    const unit = part[2].toLowerCase();
    const multiplier = unit === 'ms' ? 1 : unit === 'm' || unit === 'min' ? 60_000 : unit === 'h' ? 3_600_000 : 1000;
    return sum + Number(part[1]) * multiplier;
  }, 0);
}

export function cancelQueuedProviderRequests(): void {
  Object.values(queues).forEach((queue) => queue.cancelPending());
}

export function estimateTokens(text: string, reservedOutputTokens = 0): number {
  // A deliberately conservative estimate for mixed Latin text and JSON.
  return Math.ceil(text.length / 3.5) + reservedOutputTokens;
}

