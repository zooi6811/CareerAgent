import React, { useEffect, useMemo, useState } from 'react';
import { X, ShieldAlert, Activity, KeyRound, RefreshCw } from 'lucide-react';

type ProviderId = 'gemini' | 'groq' | 'openrouter';
interface ProviderStatus { id: ProviderId; label: string; defaultModel: string; model: string; apiKeyConfigured: boolean; apiKeySaved: boolean; freeTierNote: string }
interface AgentTask { id: string; agent: string; phase: string; startedAt: string; provider: string; model: string; status?: string; finishedAt?: string; durationMs?: number; httpStatus?: number; error?: string; errorCode?: string }
type AgentRole = 'profileAnalysis' | 'consultantChat' | 'jobSearch' | 'resumeTailoring' | 'documentRefinement';
type AgentAssignments = Record<AgentRole, { provider: ProviderId; model: string }>;
type ProviderTokenTotals = { requests: number; attempts: number; inputTokens: number; outputTokens: number; totalTokens: number };
export interface AgentMonitorState {
  model: string;
  provider: ProviderId;
  providers: ProviderStatus[];
  apiKeyConfigured: boolean;
  agentsStopped: boolean;
  activeTasks: AgentTask[];
  recentTasks: AgentTask[];
  usage: { startedAt: string; attempts: number; requests: number; inputTokens: number; outputTokens: number; totalTokens: number; requestsWithUsage: number; rateLimited: number; errors: number; lastProviderError: { code: string; message: string; at: string; provider: ProviderId } | null; providerUsage: Record<ProviderId, ProviderTokenTotals>; modelUsage: Array<ProviderTokenTotals & { provider: ProviderId; model: string }> };
  appRateLimit: { limit: number; used: number; remaining: number; windowSeconds: number };
  providerRateLimits: Record<ProviderId, Record<string, string> | null>;
  agentAssignments: AgentAssignments;
  providerRateLimit: { state: string; lastError: { code: string; message: string; at: string } | null };
}

interface Props {
  open: boolean;
  onClose: () => void;
  monitor: AgentMonitorState | null;
  refreshMonitor: () => Promise<void>;
  onToggleEmergencyStop: () => void;
  onError: (message: string) => void;
}

const providers: ProviderId[] = ['gemini', 'groq', 'openrouter'];
const providerLabel: Record<ProviderId, string> = { gemini: 'Google Gemini', groq: 'Groq', openrouter: 'OpenRouter' };
const agentNames: Array<[AgentRole, string]> = [['profileAnalysis', 'Resume & profile analysis'], ['consultantChat', 'Career consultant chat'], ['jobSearch', 'Job search + result structuring'], ['resumeTailoring', 'Resume and cover letter tailoring'], ['documentRefinement', 'Document refinement']];
const modelChoices: Record<ProviderId, Array<{ id: string; label: string }>> = {
  gemini: [{ id: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash-Lite preview' }, { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' }],
  groq: [{ id: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B' }, { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B' }],
  openrouter: [{ id: 'openrouter/free', label: 'Free model routing' }],
};

export const AgentControlsPanel: React.FC<Props> = ({ open, onClose, monitor, refreshMonitor, onToggleEmergencyStop, onError }) => {
  const [provider, setProvider] = useState<ProviderId>('gemini');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState('');
  const [assignments, setAssignments] = useState<AgentAssignments | null>(null);
  const selected = useMemo(() => monitor?.providers?.find(item => item.id === provider), [monitor?.providers, provider]);

  useEffect(() => {
    if (!open || !monitor || assignments) return;
    setProvider(monitor.provider);
    setModel(monitor.providers.find(item => item.id === monitor.provider)?.model || monitor.model);
    setApiKey('');
    setAssignments(monitor.agentAssignments);
  }, [open, monitor, assignments]);

  if (!open) return null;
  const closePanel = () => { setAssignments(null); onClose(); };

  const post = async (path: string, body: unknown) => {
    const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const responseText = await response.text();
    let data: { error?: string; code?: string; message?: string; model?: string; agents?: unknown } = {};
    if (responseText.trim()) {
      try { data = JSON.parse(responseText) as typeof data; }
      catch { throw new Error(`The server returned an unreadable response (HTTP ${response.status}). Check that the app server is running, then try again.`); }
    } else if (response.ok) throw new Error('The server returned an empty response. The request could not be confirmed.');
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
    return data;
  };

  const saveProvider = async () => {
    setSaving(true); setMessage('');
    try {
      const result = await post('/api/agent/control/provider', { provider, apiKey, model });
      setApiKey('');
      setMessage(result.message || `${providerLabel[provider]} selected.`);
      await refreshMonitor();
    } catch (error) { onError(error instanceof Error ? error.message : 'Could not update provider.'); }
    finally { setSaving(false); }
  };

  const saveAssignments = async () => {
    if (!assignments) return;
    setSaving(true); setMessage('');
    try {
      await post('/api/agent/control/provider', { provider, agents: assignments });
      setMessage('Agent assignments saved.');
      await refreshMonitor();
    } catch (error) { onError(error instanceof Error ? error.message : 'Could not save agent assignments.'); }
    finally { setSaving(false); }
  };

  const optimizeAssignments = async () => {
    setSaving(true); setMessage('');
    try {
      const result = await post('/api/agent/control/optimize', {});
      if (result.agents) setAssignments(result.agents as AgentAssignments);
      await refreshMonitor();
      setMessage(result.message || 'Suggested efficient models based on your connected providers.');
    } catch (error) { onError(error instanceof Error ? error.message : 'Could not optimize model assignments.'); }
    finally { setSaving(false); }
  };

  const checkConnection = async () => {
    setChecking(true); setMessage(`Checking ${providerLabel[provider]}…`);
    try {
      const result = await post('/api/agent/control/check', { provider });
      setMessage(result.message || `${providerLabel[provider]} connection is ready.`);
      await refreshMonitor();
    } catch (error) { setMessage('Connection check failed.'); onError(error instanceof Error ? error.message : 'Provider connection check failed.'); }
    finally { setChecking(false); }
  };

  const rateLimits = monitor?.providerRateLimits?.[provider];

  return <div className="fixed inset-0 z-50 bg-slate-950/40 p-4 sm:p-8" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) closePanel(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="agent-controls-title" className="ml-auto h-full w-full max-w-2xl overflow-y-auto rounded-xl bg-slate-50 shadow-2xl">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-4">
        <div><p className="text-xs text-slate-500">Runtime, usage, and safety controls</p><h2 id="agent-controls-title" className="text-xl font-bold">Agent Controls</h2></div>
        <button type="button" onClick={closePanel} aria-label="Close Agent Controls" className="rounded p-2 hover:bg-slate-100"><X className="h-5 w-5"/></button>
      </header>
      <div className="space-y-4 p-5">
        <section className="rounded-lg border bg-white p-4">
          <div className="mb-3 flex items-center gap-2"><KeyRound className="h-4 w-4"/><h3 className="font-semibold">Model provider</h3></div>
          <p className="mb-3 text-xs text-slate-600">Connect several providers at once. Each agent below can use a different provider and model. Keys you enter are encrypted with Windows DPAPI and saved for your Windows account; they are never put in browser storage or returned to the page.</p>
          <label className="mb-1 block text-xs font-medium" htmlFor="runtime-provider">Provider</label>
          <select id="runtime-provider" value={provider} onChange={e => { const next = e.target.value as ProviderId; setProvider(next); setModel(monitor?.providers?.find(item => item.id === next)?.model || ''); setApiKey(''); setMessage(''); }} className="mb-3 w-full rounded-md border px-3 py-2 text-sm">
            {providers.map(id => <option value={id} key={id}>{providerLabel[id]}</option>)}
          </select>
          <label className="mb-1 block text-xs font-medium" htmlFor="runtime-model">Model ID</label>
          <div className="flex gap-2"><input id="runtime-model" value={model} onChange={e => setModel(e.target.value)} placeholder={selected?.defaultModel || 'Model ID'} className="min-w-0 flex-1 rounded-md border px-3 py-2 text-sm"/><button type="button" onClick={() => setModel(selected?.defaultModel || '')} className="rounded-md border px-3 py-2 text-xs">Free default</button></div>
          <p className="mt-1 text-[11px] text-slate-500">{selected?.freeTierNote || ''}{provider === 'openrouter' && ' The default openrouter/free route selects free models; custom model IDs may cost money.'}</p>
          <label className="mb-1 mt-3 block text-xs font-medium" htmlFor="runtime-provider-key">{providerLabel[provider]} API key</label>
          <div className="flex flex-wrap gap-2"><input id="runtime-provider-key" type="password" autoComplete="new-password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder={selected?.apiKeyConfigured ? 'Key configured — enter a replacement or leave blank' : `Paste ${providerLabel[provider]} API key`} className="min-w-0 flex-1 rounded-md border px-3 py-2 text-sm"/><button disabled={!model.trim() || saving} onClick={() => void saveProvider()} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : apiKey ? 'Save key' : 'Save provider model'}</button></div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className={`text-xs font-medium ${selected?.apiKeyConfigured ? 'text-emerald-700' : 'text-amber-700'}`}>{selected?.apiKeySaved ? 'Key saved securely for this Windows account' : selected?.apiKeyConfigured ? 'Key available from server environment (not saved by the app)' : 'API key not configured'}</span><div className="flex gap-2">{selected?.apiKeySaved && <button type="button" disabled={saving} onClick={async () => { setSaving(true); try { await post('/api/agent/control/provider', { provider, clearKey: true }); setMessage(`${providerLabel[provider]} saved key removed.`); await refreshMonitor(); } catch (error) { onError(error instanceof Error ? error.message : 'Could not remove key.'); } finally { setSaving(false); } }} className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-700">Remove saved key</button>}<button disabled={!selected?.apiKeyConfigured || checking || monitor?.agentsStopped} onClick={() => void checkConnection()} className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${checking ? 'animate-spin' : ''}`}/>{checking ? 'Checking…' : 'Check connection'}</button></div></div>
          {message && <p role="status" className="mt-2 text-xs text-slate-700">{message}</p>}
          <div className="mt-3 space-y-1 rounded-md bg-slate-50 p-3 text-xs"><strong>Connected API keys</strong>{monitor?.providers.map(item => <p key={item.id} className={item.apiKeyConfigured ? 'text-emerald-700' : 'text-slate-500'}>{item.apiKeyConfigured ? '● Connected' : '○ Not connected'} · {item.label}{item.apiKeySaved ? ' · saved securely' : ''} · configured model: {item.model}</p>)}</div>
        </section>

        <section className="rounded-lg border bg-white p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">Agent provider and model</h3><p className="text-[11px] text-slate-500">Choose models per task. Optimize applies low-token assignments using connected providers. Manual changes apply when you save. Job search uses Gemini grounding or Groq browser search; PDF text extraction runs locally without tokens.</p></div><div className="flex gap-2"><button type="button" disabled={saving || !assignments || monitor?.agentsStopped} onClick={() => void optimizeAssignments()} className="rounded-md border px-3 py-2 text-xs font-semibold disabled:opacity-50">Optimize models</button><button type="button" disabled={saving || !assignments} onClick={() => void saveAssignments()} className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save assignments'}</button></div></div>
          <div className="space-y-3">{agentNames.map(([role, name]) => { const assignment = assignments?.[role]; const options = modelChoices[assignment?.provider || 'gemini']; return <div key={role} className="grid grid-cols-1 gap-2 rounded-md bg-slate-50 p-3 sm:grid-cols-[1fr_130px_1fr]"><label className="self-center text-xs font-semibold">{name}</label><select aria-label={`${name} provider`} value={assignment?.provider || 'gemini'} onChange={e => { const next = e.target.value as ProviderId; setAssignments(current => current && ({ ...current, [role]: { provider: next, model: monitor?.providers.find(item => item.id === next)?.defaultModel || modelChoices[next][0].id } })); }} className="rounded-md border bg-white px-2 py-2 text-xs">{providers.map(id => <option key={id} value={id}>{providerLabel[id]}</option>)}</select><div className="flex min-w-0 gap-1"><select aria-label={`${name} model preset`} value={options.some(option => option.id === assignment?.model) ? assignment?.model : '__custom'} onChange={e => e.target.value !== '__custom' && setAssignments(current => current && ({ ...current, [role]: { ...current[role], model: e.target.value } }))} className="min-w-0 flex-1 rounded-md border bg-white px-2 py-2 text-xs"><option value="__custom">Custom model…</option>{options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select><input aria-label={`${name} model ID`} value={assignment?.model || ''} onChange={e => setAssignments(current => current && ({ ...current, [role]: { ...current[role], model: e.target.value } }))} placeholder="Model ID" className="min-w-0 flex-1 rounded-md border bg-white px-2 py-2 text-xs" /></div></div>; })}</div>
          {message && <p role="status" className="mt-2 text-xs text-slate-700">{message}</p>}
        </section>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[['Default provider', providerLabel[monitor?.provider || 'gemini']], ['Default model', monitor?.model || '—'], ['API attempts', String(monitor?.usage.attempts ?? 0)], ['Reported tokens', String(monitor?.usage.totalTokens ?? 0)]].map(([label, value]) => <div key={label} className="rounded-lg border bg-white p-3"><p className="text-[11px] text-slate-500">{label}</p><p className="mt-1 break-all font-mono text-sm font-semibold">{value}</p></div>)}
        </section>
        <p className="-mt-2 text-[11px] text-slate-500">Session totals since server start · {monitor?.usage.inputTokens ?? 0} input · {monitor?.usage.outputTokens ?? 0} output · provider reported usage for {monitor?.usage.requestsWithUsage ?? 0}/{monitor?.usage.requests ?? 0} successful calls · {monitor?.usage.attempts ?? 0} provider attempts including retries, {monitor?.usage.errors ?? 0} failed attempts.</p>
        <section className="rounded-lg border bg-white p-4"><h3 className="mb-1 font-semibold">Usage by provider and model</h3><p className="mb-2 text-[11px] text-slate-500">Attempts include calls that timed out or failed. Tokens are shown only when the provider returns usage metadata.</p><div className="space-y-1.5">{(monitor?.usage.modelUsage || []).length ? monitor!.usage.modelUsage.map(item => <div key={`${item.provider}:${item.model}`} className="flex flex-wrap items-center justify-between gap-2 text-xs"><span>{providerLabel[item.provider]} · <span className="font-mono">{item.model}</span> · {item.attempts} attempts / {item.requests} successful responses</span><span className="font-mono">{item.totalTokens} reported tokens ({item.inputTokens} in / {item.outputTokens} out)</span></div>) : providers.map(id => { const totals = monitor?.usage.providerUsage?.[id]; return <div key={id} className="flex items-center justify-between gap-3 text-xs"><span>{providerLabel[id]} · {totals?.attempts ?? 0} attempts</span><span className="font-mono">{totals?.totalTokens ?? 0} reported tokens</span></div>; })}</div></section>

        <section className="rounded-lg border bg-white p-4">
          <div className="mb-3 flex items-center gap-2"><Activity className="h-4 w-4"/><h3 className="font-semibold">Agent activity</h3><span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs">{monitor?.activeTasks.length ?? 0} active</span></div>
          {monitor?.activeTasks.length ? <ul className="space-y-2">{monitor.activeTasks.map(task => { const elapsed = Math.max(0, Math.round((Date.now() - Date.parse(task.startedAt)) / 1000)); const slow = elapsed >= 45; return <li key={task.id} className="rounded-md bg-slate-50 p-3"><div className="flex items-center justify-between gap-3 text-sm font-semibold"><span>{task.agent}</span><span className={slow ? 'text-amber-700' : 'animate-pulse text-emerald-700'}>{slow ? `Long-running · ${elapsed}s` : `Running · ${elapsed}s`}</span></div><p className="mt-1 text-xs text-slate-600">{task.phase}</p><p className="mt-1 text-[10px] text-slate-400">{task.provider} · {task.model} · started {new Date(task.startedAt).toLocaleTimeString()}</p></li>; })}</ul> : <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">Agents are idle. Active stages appear here while they run.</p>}
          <div className="mt-3 rounded-md border border-slate-100 p-3 text-xs"><strong>App limit:</strong> {monitor?.appRateLimit.used ?? 0}/{monitor?.appRateLimit.limit ?? 20} operational requests in the last minute · {monitor?.appRateLimit.remaining ?? 20} remaining.</div>
          <div className="mt-2 rounded-md border border-slate-100 p-3 text-xs"><strong>{providerLabel[provider]} limits:</strong> {rateLimits ? Object.entries(rateLimits).map(([key, value]) => `${key.replace('x-ratelimit-', '').replaceAll('-', ' ')} ${value}`).join(' · ') : provider === 'gemini' ? 'Gemini does not include remaining account quota here; check your Google AI Studio project.' : 'No rate-limit headers received yet. Limits vary by model and account.'}{rateLimits && (rateLimits['retry-after'] || rateLimits['x-ratelimit-reset-requests'] || rateLimits['x-ratelimit-reset-tokens']) && <p className="mt-1 font-medium text-slate-700">Provider reset/cooldown signal: {rateLimits['retry-after'] ? `${rateLimits['retry-after']} seconds (Retry-After)` : rateLimits['x-ratelimit-reset-requests'] || rateLimits['x-ratelimit-reset-tokens']}. This is the provider’s supplied window reset, not necessarily its daily reset.</p>}{monitor?.usage.lastProviderError?.provider === provider && monitor.usage.lastProviderError.code === 'rate_limited' && <p role="alert" className="mt-2 font-semibold text-red-700">{monitor.usage.lastProviderError.message} {monitor.usage.lastProviderError.message.toLowerCase().includes('daily quota') ? 'The app will show a refresh time only when the provider supplies one.' : ''}</p>}<p className="mt-1">{monitor?.usage.rateLimited ?? 0} provider 429 events this session. App token totals include only usage metadata returned by the provider; calls without usage metadata are identified above.</p></div>
        </section>

        <section className="rounded-lg border bg-white p-4"><div className="mb-2 flex items-center gap-2"><Activity className="h-4 w-4"/><h3 className="font-semibold">Recent task diagnostics</h3><span className="ml-auto text-[11px] text-slate-500">Last {monitor?.recentTasks?.length ?? 0} · current server session</span></div><p className="mb-2 text-[11px] text-slate-500">Use this history to distinguish provider quota errors, app rate limits, timeouts, model failures, partial results, and successful work. Repeated entries for the same agent can reveal duplicate triggers. Provider retries are capped at three attempts. Task history resets when the server restarts.</p>{monitor?.recentTasks?.length ? <ul className="max-h-72 space-y-2 overflow-y-auto">{monitor.recentTasks.map(task => <li key={task.id} className="rounded-md bg-slate-50 p-3"><div className="flex flex-wrap items-center justify-between gap-2 text-xs"><strong>{task.agent}</strong><span className={task.status === 'completed' ? 'font-semibold text-emerald-700' : task.status === 'partial' ? 'font-semibold text-amber-700' : 'font-semibold text-red-700'}>{task.status || 'finished'}{task.httpStatus ? ` · HTTP ${task.httpStatus}` : ''}</span></div><p className="mt-1 text-xs text-slate-600">{task.phase}</p><p className="mt-1 text-[10px] text-slate-500">{task.provider} · {task.model} · {task.durationMs ? `${(task.durationMs / 1000).toFixed(1)}s` : 'duration unknown'} · {task.finishedAt ? new Date(task.finishedAt).toLocaleTimeString() : ''}{task.errorCode ? ` · ${task.errorCode}` : ''}</p></li>)}</ul> : <p className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">No finished agent requests this session yet.</p>}</section>

        <section className="rounded-lg border bg-white p-4">
          <div className="mb-2 flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-red-700"/><h3 className="font-semibold">Emergency stop</h3></div>
          <p className="mb-3 text-xs text-slate-600">Stops active requests to every configured model provider and blocks new agent work until you resume agents.</p>
          <p className={`text-xs font-semibold ${monitor?.agentsStopped ? 'text-red-700' : 'text-emerald-700'}`}>{monitor?.agentsStopped ? 'Emergency stop is active' : 'Agents are enabled'}</p>
          <button type="button" onClick={onToggleEmergencyStop} className={`mt-3 rounded-md px-3 py-2 text-xs font-semibold text-white ${monitor?.agentsStopped ? 'bg-emerald-700' : 'bg-red-700'}`}>{monitor?.agentsStopped ? 'Resume Agents' : 'Emergency Stop'}</button>
        </section>
      </div>
    </section>
  </div>;
};
