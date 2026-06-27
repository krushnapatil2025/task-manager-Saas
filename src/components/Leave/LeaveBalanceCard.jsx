import React from 'react';
import { LuCalendarCheck } from 'react-icons/lu';

const LeaveBalanceCard = ({ balance }) => {
  if (!balance || !balance.leaveType) return null;

  const { leaveType, total_days, used_days, pending_days } = balance;
  const total = Number(total_days) || 0;
  const used = Number(used_days) || 0;
  const pending = Number(pending_days) || 0;

  // For unlimited leaves
  const isUnlimited = total === 0;
  const remaining = isUnlimited ? '∞' : Math.max(total - used - pending, 0);

  const baseColor = leaveType.color || '#6366F1';
  const percentage = isUnlimited ? 0 : Math.min(((used + pending) / total) * 100, 100);

  return (
    <div className="card flex flex-col gap-4 !p-5 relative overflow-hidden transition-all duration-300 hover:shadow-md hover:translate-y-[-2px] dark:bg-[#151518]/90 dark:border-zinc-800/80">
      {/* Visual background glow */}
      <div 
        className="absolute top-0 right-0 w-24 h-24 rounded-full blur-[45px] opacity-10 pointer-events-none"
        style={{ backgroundColor: baseColor }}
      />

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div 
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${baseColor}15`, color: baseColor }}
          >
            <LuCalendarCheck size={18} />
          </div>
          <div>
            <h4 className="font-extrabold text-xs text-slate-800 dark:text-zinc-200 uppercase tracking-wider">{leaveType.name}</h4>
            <p className="text-[10px] text-slate-400 dark:text-zinc-550 font-bold uppercase tracking-wider mt-0.5">{leaveType.code}</p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-xl font-extrabold text-slate-900 dark:text-white leading-none">
            {remaining}
          </p>
          <p className="text-[9px] font-extrabold text-slate-400 dark:text-zinc-550 uppercase tracking-widest mt-1">Available</p>
        </div>
      </div>

      {/* Progress section */}
      {!isUnlimited && (
        <div className="space-y-1.5 mt-2">
          <div className="h-1.5 w-full bg-slate-100 dark:bg-zinc-800/60 rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${percentage}%`, backgroundColor: baseColor }}
            />
          </div>
          <div className="flex justify-between items-center text-[10px] font-bold uppercase text-slate-400 dark:text-zinc-500">
            <span>Used: {used} d</span>
            {pending > 0 && <span className="text-amber-500">Pending: {pending} d</span>}
            <span>Total: {total} d</span>
          </div>
        </div>
      )}

      {isUnlimited && (
        <div className="mt-4 pt-1 border-t border-dashed border-slate-100 dark:border-zinc-800/80">
          <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase">
            No yearly limit for this leave category.
          </p>
        </div>
      )}
    </div>
  );
};

export default LeaveBalanceCard;
