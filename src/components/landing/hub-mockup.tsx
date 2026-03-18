// src/components/landing/hub-mockup.tsx
export function HubMockup() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-2xl -rotate-1 overflow-hidden">
      <div className="flex">
        {/* Fake webdock sidebar */}
        <div className="w-10 bg-gray-900 flex flex-col items-center py-3 gap-2">
          <div className="h-5 w-5 rounded bg-[#03b9ff]/30" />
          <div className="h-5 w-5 rounded bg-emerald-500/30" />
          <div className="h-5 w-5 rounded bg-purple-500/30" />
        </div>

        <div className="flex-1 p-4 space-y-3">
          <span className="text-xs font-semibold text-gray-700">My Workspace</span>

          {/* Task cards */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded border border-gray-100 bg-gray-50 px-2 py-1.5">
              <div className="h-3.5 w-3.5 rounded-full bg-emerald-500 flex items-center justify-center">
                <svg className="h-2 w-2 text-white" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <span className="text-[10px] text-gray-600">Homepage mockup</span>
            </div>
            <div className="flex items-center gap-2 rounded border border-primary/30 bg-primary/5 px-2 py-1.5">
              <div className="h-3.5 w-3.5 rounded-full border-2 border-primary" />
              <span className="text-[10px] text-gray-600">Icon set - In Progress</span>
            </div>
          </div>

          {/* Earnings mini-graph */}
          <div className="flex items-end gap-1 pt-1">
            <div className="w-4 bg-primary/20 rounded-t" style={{ height: '16px' }} />
            <div className="w-4 bg-primary/40 rounded-t" style={{ height: '24px' }} />
            <div className="w-4 bg-primary rounded-t" style={{ height: '32px' }} />
            <span className="text-[9px] text-gray-400 ml-1 self-end">Earnings ↑</span>
          </div>
        </div>
      </div>
    </div>
  );
}
