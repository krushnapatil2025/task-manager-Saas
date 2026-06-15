import React from 'react';

const InfoCard = ({ icon: Icon, label, value = 0, color = "bg-indigo-600" }) => {
  return (
    <div className="flex items-center gap-4 p-5 rounded-2xl bg-white/80 border border-slate-200/50 shadow-[0_2px_8px_rgba(0,0,0,0.015),0_8px_20px_rgba(148,163,184,0.03)] hover:border-slate-300/80 transition-all duration-300">
      <div className={`flex items-center justify-center w-10 h-10 ${color} text-white rounded-xl shadow-sm`}>
        {Icon ? <Icon className="text-lg" /> : <span className="font-bold text-xs uppercase">T</span>}
      </div>
      <div>
        <span className="block text-xl font-extrabold text-slate-800 tracking-tight">{value}</span>
        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{label}</span>
      </div>
    </div>
  );
};

export default InfoCard;