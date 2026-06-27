import React, { useEffect, useState } from 'react';
import { LuTerminal, LuChartPie, LuImage, LuSparkles, LuBellRing } from 'react-icons/lu';

const COMMANDS = [
  {
    cmd: '/poll',
    desc: 'Create an interactive teams poll',
    usage: '/poll [question]',
    icon: <LuChartPie className="text-indigo-600" size={15} />
  },
  {
    cmd: '/giphy',
    desc: 'Share a animated GIF reaction',
    usage: '/giphy [search-term]',
    icon: <LuImage className="text-pink-500" size={15} />
  },
  {
    cmd: '/status',
    desc: 'Update your status text instantly',
    usage: '/status [your status message]',
    icon: <LuSparkles className="text-amber-500" size={15} />
  },
  {
    cmd: '/remind',
    desc: 'Set a custom reminder alert',
    usage: '/remind @username [reminder text]',
    icon: <LuBellRing className="text-purple-500" size={15} />
  }
];

export const SlashCommandPalette = ({ query = '', onSelectCommand }) => {
  const [filtered, setFiltered] = useState(COMMANDS);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const q = query.toLowerCase();
    const matches = COMMANDS.filter(c => c.cmd.toLowerCase().includes(q));
    setFiltered(matches);
    setActiveIdx(0);
  }, [query]);

  // Navigate and select via keyboard
  useEffect(() => {
    const handleKeys = (e) => {
      if (filtered.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx(prev => (prev + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx(prev => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onSelectCommand(filtered[activeIdx]);
      }
    };
    window.addEventListener('keydown', handleKeys, true);
    return () => window.removeEventListener('keydown', handleKeys, true);
  }, [filtered, activeIdx, onSelectCommand]);

  if (filtered.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 mb-2 w-72 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-50 overflow-hidden backdrop-blur-md animate-fade-in-up">
      <div className="p-2 border-b border-slate-100 dark:border-zinc-900 bg-slate-50/50 dark:bg-zinc-900/40 flex items-center gap-1.5 text-slate-400">
        <LuTerminal size={12} />
        <span className="text-[9px] font-bold uppercase tracking-wider">Slash Commands</span>
      </div>
      <div className="flex flex-col max-h-64 overflow-y-auto">
        {filtered.map((item, idx) => (
          <button
            key={item.cmd}
            type="button"
            onClick={() => onSelectCommand(item)}
            className={`w-full text-left p-3 flex items-start gap-3 transition-colors ${
              idx === activeIdx 
                ? 'bg-indigo-50/60 dark:bg-indigo-950/20 border-l-2 border-indigo-500' 
                : 'hover:bg-slate-50 dark:hover:bg-zinc-900/30'
            }`}
          >
            <div className="mt-0.5">{item.icon}</div>
            <div className="flex-1 flex flex-col min-w-0">
              <span className="text-[11px] font-bold text-slate-800 dark:text-zinc-150">{item.cmd}</span>
              <span className="text-[9px] text-slate-400 dark:text-zinc-500 mt-0.5 truncate">{item.desc}</span>
              <span className="text-[8px] text-slate-350 dark:text-zinc-650 font-mono mt-0.5">{item.usage}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default SlashCommandPalette;
