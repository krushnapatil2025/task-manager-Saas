import React from 'react';

const InfoCard = ({ icon: Icon, label, value = 0, color = "bg-indigo-650" }) => {
  // Map standard tailwind color backgrounds to clean dark mode safe tint colors
  const tintClass = 
    color.includes('indigo') ? 'bg-indigo-50/50 text-indigo-600 border border-indigo-100/50 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/30' :
    color.includes('amber')  ? 'bg-amber-50/50 text-amber-600 border border-amber-100/50 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30' :
    color.includes('cyan')   ? 'bg-cyan-50/50 text-cyan-600 border border-cyan-100/50 dark:bg-cyan-950/20 dark:text-cyan-400 dark:border-cyan-900/30' :
    color.includes('emerald')? 'bg-emerald-50/50 text-emerald-600 border border-emerald-100/50 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30' :
    'bg-slate-50 text-slate-600 border border-slate-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800';

  return (
    <div className="flex items-center gap-4.5 p-5 rounded-xl bg-white dark:bg-[#121215] border border-slate-200/50 dark:border-zinc-800 shadow-[0_1px_3px_rgba(15,23,42,0.03),0_4px_12px_rgba(15,23,42,0.02)] hover:border-slate-350 dark:hover:border-zinc-700 hover:shadow-[0_4px_20px_rgba(15,23,42,0.05)] transition-all duration-300">
      <div className={`flex items-center justify-center w-11 h-11 rounded-lg shrink-0 ${tintClass}`}>
        {Icon ? <Icon size={20} /> : <span className="font-extrabold text-xs">T</span>}
      </div>
      <div className="min-w-0">
        <span className="block text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">{label}</span>
        <span className="block text-2xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight mt-1">{value}</span>
      </div>
    </div>
  );
};

export default InfoCard;