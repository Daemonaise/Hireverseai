// src/components/landing/dashboard-mockup.tsx
export function DashboardMockup() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-2xl rotate-1 overflow-hidden">
      {/* Fake toolbar */}
      <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 border-b border-gray-200">
        <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
        <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
        <span className="ml-2 text-[10px] text-gray-400 font-medium">Client Dashboard</span>
      </div>

      <div className="p-4 space-y-3">
        {/* Project status */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-700">Logo Redesign</span>
          <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-medium">In Progress</span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-gray-100">
          <div className="h-full w-[65%] rounded-full bg-[#03b9ff]" />
        </div>

        {/* Timeline */}
        <div className="flex items-center gap-1 text-[10px] text-gray-400">
          <span>Started Mar 10</span>
          <span className="mx-1">&middot;</span>
          <span>Due Mar 24</span>
        </div>

        {/* Team avatars */}
        <div className="flex items-center gap-1">
          <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary">JD</div>
          <div className="h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center text-[9px] font-bold text-emerald-600">MS</div>
          <div className="h-6 w-6 rounded-full bg-purple-100 flex items-center justify-center text-[9px] font-bold text-purple-600">AK</div>
          <span className="text-[10px] text-gray-400 ml-1">3 freelancers assigned</span>
        </div>
      </div>
    </div>
  );
}
