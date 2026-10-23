import React from 'react';

export type ActiveTab =
  | 'careerhub'
  | 'feed'
  | 'cover-letter'
  | 'tracker'
  | 'preferences';

interface TopBarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onRunAgentScan: () => void;
  isScanning: boolean;
  trackedCount: number;
  onOpenAgentControls: () => void;
  onToggleEmergencyStop: () => void;
  agentsStopped: boolean;
  activeAgentCount: number;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onSelectTab,
  onRunAgentScan,
  isScanning,
  trackedCount,
  onOpenAgentControls,
  onToggleEmergencyStop,
  agentsStopped,
  activeAgentCount,
}) => {
  const navItems: { id: ActiveTab; label: string }[] = [
    { id: 'careerhub', label: 'CareerHub' },
    { id: 'feed', label: 'Daily Feed' },
    { id: 'cover-letter', label: 'Tailor & Apply' },
    { id: 'tracker', label: `Applications (${trackedCount})` },
    { id: 'preferences', label: 'Profile & Resume' },
  ];

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 lg:gap-8 px-4 sm:px-6 py-3.5 bg-white/95 backdrop-blur border-b border-slate-200">
      {/* Zone 1: Single text element wordmark */}
      <a
        href="#feed"
        onClick={(e) => {
          e.preventDefault();
          onSelectTab('feed');
        }}
        className="text-base sm:text-lg font-bold tracking-tight text-slate-900 font-display whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
      >
        Meridian Career
      </a>

      {/* Zone 2: 5 concise single-line navigation links */}
      <nav
        aria-label="Primary Workspace Navigation"
        className="flex items-center gap-3 sm:gap-6 overflow-x-auto text-xs sm:text-sm font-medium text-slate-600"
      >
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
                isActive
                  ? 'border-slate-900 text-slate-900 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: 1 primary action */}
      <div className="flex items-center gap-2 shrink-0">
        <button type="button" onClick={onOpenAgentControls} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
          Agent Controls{activeAgentCount > 0 ? ` · ${activeAgentCount} active` : ''}
        </button>
        <button
          type="button"
          onClick={onToggleEmergencyStop}
          className={`px-3 py-2 text-xs font-semibold text-white rounded-lg whitespace-nowrap ${agentsStopped ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-red-700 hover:bg-red-800'}`}
        >
          {agentsStopped ? 'Resume Agents' : 'Emergency Stop'}
        </button>
        <button type="button" onClick={onRunAgentScan} disabled={isScanning || agentsStopped} className="px-3 sm:px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900">
          {isScanning ? 'Scanning Job Boards...' : 'Run Agent Scan'}
        </button>
      </div>
    </header>
  );
};
