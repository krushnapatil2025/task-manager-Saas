import React, { useState, useEffect } from 'react';
import { LuExternalLink, LuLink } from 'react-icons/lu';

const LinkPreviewCard = ({ url }) => {
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    if (!url) return;

    const fetchMetadata = async () => {
      setLoading(true);
      setError(false);
      try {
        const response = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`);
        if (!response.ok) throw new Error('Failed to fetch link metadata');
        const json = await response.json();
        
        if (active && json.status === 'success' && json.data) {
          setMetadata({
            title: json.data.title,
            description: json.data.description,
            image: json.data.image?.url || null,
            logo: json.data.logo?.url || null,
            publisher: json.data.publisher || null,
            url: json.data.url || url
          });
        } else {
          throw new Error('Invalid metadata format');
        }
      } catch (err) {
        if (active) {
          setError(true);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchMetadata();
    return () => {
      active = false;
    };
  }, [url]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-2 bg-slate-50/50 border border-slate-150 rounded-xl max-w-md animate-pulse">
        <div className="w-16 h-16 bg-slate-200 rounded-lg flex-shrink-0" />
        <div className="flex-1 flex flex-col gap-1.5">
          <div className="h-3 bg-slate-200 rounded w-3/4" />
          <div className="h-2.5 bg-slate-200 rounded w-5/6" />
          <div className="h-2 bg-slate-200 rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (error || !metadata || (!metadata.title && !metadata.description)) {
    // Elegant fallback card
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between gap-3 p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/60 rounded-xl max-w-md transition-all duration-300 group hover:-translate-y-0.5 shadow-sm"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0 border border-indigo-100">
            <LuLink size={14} />
          </div>
          <div className="min-w-0 flex flex-col">
            <span className="text-xs font-semibold text-slate-700 truncate">{url}</span>
            <span className="text-[9px] text-slate-400">Open Link</span>
          </div>
        </div>
        <LuExternalLink size={12} className="text-slate-400 group-hover:text-indigo-650 transition-colors flex-shrink-0" />
      </a>
    );
  }

  return (
    <a
      href={metadata.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col sm:flex-row gap-3 p-3 bg-white hover:bg-slate-50/70 border border-slate-200 rounded-xl max-w-lg transition-all duration-350 group hover:-translate-y-0.5 hover:shadow-md overflow-hidden"
    >
      {metadata.image && (
        <div className="w-full sm:w-24 h-24 sm:h-auto rounded-lg overflow-hidden flex-shrink-0 border border-slate-100">
          <img
            src={metadata.image}
            alt={metadata.title || 'Preview'}
            className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-500"
          />
        </div>
      )}
      
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        <div className="flex flex-col gap-1">
          {/* Header row: Publisher / Logo */}
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
            {metadata.logo && (
              <img src={metadata.logo} alt="" className="w-3 h-3 rounded-sm object-contain" />
            )}
            <span className="truncate">{metadata.publisher || new URL(url).hostname}</span>
          </div>
          
          <h4 className="text-xs font-bold text-slate-800 line-clamp-1 group-hover:text-indigo-600 transition-colors">
            {metadata.title}
          </h4>
          
          {metadata.description && (
            <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed">
              {metadata.description}
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-1 mt-2 text-[9px] text-indigo-600 font-semibold">
          <span>Visit website</span>
          <LuExternalLink size={10} className="group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </a>
  );
};

export default LinkPreviewCard;
