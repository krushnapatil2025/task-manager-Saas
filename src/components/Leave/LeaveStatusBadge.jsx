import React from 'react';
import { LuClock, LuCircleCheck, LuCircleX, LuUndo, LuCircleMinus } from 'react-icons/lu';

const LeaveStatusBadge = ({ status }) => {
  const config = {
    pending: {
      label: 'Pending',
      icon: <LuClock size={12} />,
      cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-900/30'
    },
    approved: {
      label: 'Approved',
      icon: <LuCircleCheck size={12} />,
      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-900/30'
    },
    rejected: {
      label: 'Rejected',
      icon: <LuCircleX size={12} />,
      cls: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-300 dark:border-red-900/30'
    },
    withdrawn: {
      label: 'Withdrawn',
      icon: <LuUndo size={12} />,
      cls: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-zinc-800/40 dark:text-zinc-400 dark:border-zinc-700'
    },
    cancelled: {
      label: 'Cancelled',
      icon: <LuCircleMinus size={12} />,
      cls: 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800/30 dark:text-zinc-500 dark:border-zinc-800'
    }
  };

  const current = config[status?.toLowerCase()] || {
    label: status || 'Unknown',
    icon: null,
    cls: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-zinc-800/40 dark:text-zinc-400 dark:border-zinc-700'
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider ${current.cls}`}>
      {current.icon}
      {current.label}
    </span>
  );
};

export default LeaveStatusBadge;
