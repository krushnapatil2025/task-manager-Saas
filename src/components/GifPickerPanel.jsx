import React, { useState, useEffect } from 'react';
import { LuSearch, LuLoaderCircle } from 'react-icons/lu';

const GifPickerPanel = ({ onSelect, onClose }) => {
  const [search, setSearch] = useState('');
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchGifs = async (query = '') => {
    setLoading(true);
    try {
      const q = query.trim() || 'trending';
      const response = await fetch(
        `https://g.tenor.com/v1/search?q=${encodeURIComponent(q)}&key=LIVDSRZULELA&limit=16`
      );
      if (!response.ok) throw new Error('Failed to fetch GIFs');
      const data = await response.json();
      
      const formatted = (data.results || []).map(item => ({
        id: item.id,
        title: item.title || item.content_description || 'GIF',
        url: item.media?.[0]?.gif?.url || item.url,
        preview: item.media?.[0]?.tinygif?.url || item.media?.[0]?.gif?.url
      })).filter(g => g.url);

      setGifs(formatted);
    } catch (err) {
      console.error('Error fetching GIFs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGifs();
  }, []);

  // Debounced search
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchGifs(search);
    }, 500);

    return () => clearTimeout(delayDebounce);
  }, [search]);

  return (
    <div className="absolute bottom-full left-4 z-50 mb-2 w-72 h-80 bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-2xl rounded-2xl flex flex-col overflow-hidden animate-scale-in">
      {/* Search Header */}
      <div className="p-3 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
        <LuSearch size={14} className="text-slate-400" />
        <input
          type="text"
          placeholder="Search GIFs..."
          className="flex-1 bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        {onClose && (
          <button 
            onClick={onClose} 
            className="text-[10px] text-slate-400 hover:text-slate-600 font-bold hover:bg-slate-200/50 rounded p-1"
          >
            ✕
          </button>
        )}
      </div>

      {/* GIFs List */}
      <div className="flex-1 overflow-y-auto p-2 grid grid-cols-2 gap-1.5 custom-scrollbar">
        {loading ? (
          <div className="col-span-2 flex items-center justify-center py-20">
            <LuLoaderCircle className="animate-spin text-indigo-500" size={24} />
          </div>
        ) : gifs.length > 0 ? (
          gifs.map(gif => (
            <button
              key={gif.id}
              onClick={() => onSelect(gif)}
              className="relative aspect-video w-full rounded-lg overflow-hidden border border-slate-100 hover:border-indigo-400 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer group"
            >
              <img
                src={gif.preview}
                alt={gif.title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-[8px] text-white truncate text-left">{gif.title}</p>
              </div>
            </button>
          ))
        ) : (
          <div className="col-span-2 text-center py-20 text-xs text-slate-400">
            No GIFs found 😢
          </div>
        )}
      </div>
    </div>
  );
};

export default GifPickerPanel;
