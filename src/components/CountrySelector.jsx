import React, { useState, useEffect, useRef } from 'react';
import { COUNTRIES } from '../utils/countries';
import { LuChevronDown } from 'react-icons/lu';

/**
 * CountrySelector — A premium search-enabled dropdown for choosing countries.
 * Props:
 *  value: Country object { code, name, dial_code, flag }
 *  onChange: Callback function when a country is selected
 */
const CountrySelector = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter countries based on search term
  const filteredCountries = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.dial_code.includes(search)
  );

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          setSearch('');
        }}
        className="flex items-center justify-between gap-1.5 px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-extrabold text-slate-800 dark:text-zinc-200 hover:border-slate-350 dark:hover:border-zinc-700 transition cursor-pointer h-[38px] min-w-[95px] select-none"
      >
        <div className="flex items-center gap-1.5">
          <span className="text-base leading-none select-none">{value?.flag || '🇮🇳'}</span>
          <span className="font-bold">{value?.dial_code || '+91'}</span>
        </div>
        <LuChevronDown className={`text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} size={12} />
      </button>

      {/* Floating Menu */}
      {open && (
        <div className="absolute z-50 left-0 top-[44px] bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800/80 shadow-2xl rounded-2xl w-[260px] p-2 flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-1 duration-200 select-none">
          {/* Search Input */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search country or code..."
            className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-850 rounded-lg text-xs outline-none text-slate-800 dark:text-zinc-200 placeholder-slate-400 font-semibold"
            autoFocus
          />

          {/* List Wrapper */}
          <div className="max-h-[220px] overflow-y-auto flex flex-col gap-0.5 no-scrollbar">
            {filteredCountries.length > 0 ? (
              filteredCountries.map((c) => (
                <button
                  key={`${c.code}-${c.dial_code}`}
                  type="button"
                  onClick={() => {
                    onChange(c);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-2 text-left rounded-lg transition-colors cursor-pointer ${
                    value?.code === c.code
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
                      : 'hover:bg-slate-50 dark:hover:bg-zinc-800/50 text-slate-700 dark:text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="text-sm select-none flex-shrink-0">{c.flag}</span>
                    <span className="text-xs font-bold truncate max-w-[130px]">{c.name}</span>
                  </div>
                  <span className="text-[10px] font-extrabold opacity-60 flex-shrink-0">{c.dial_code}</span>
                </button>
              ))
            ) : (
              <div className="text-center py-4 text-xs font-bold text-slate-400 dark:text-zinc-600">
                No countries found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CountrySelector;
