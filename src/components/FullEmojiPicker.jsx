import React, { useState, useMemo } from 'react';
import { LuSearch, LuSmile, LuUsers, LuHeart, LuCompass, LuSparkles, LuFolderOpen } from 'react-icons/lu';

const EMOJI_CATEGORIES = [
  {
    id: 'smileys',
    name: 'Smileys & Emotion',
    icon: <LuSmile size={14} />,
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', 
      '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸', '🤩', '🥳', '😏', '😒', '😞', '😔', 
      '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', 
      '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🫣', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🫨', '🫵'
    ]
  },
  {
    id: 'people',
    name: 'People & Body',
    icon: <LuUsers size={14} />,
    emojis: [
      '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', 
      '👇', '🫵', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', 
      '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄', '💋', '🩸'
    ]
  },
  {
    id: 'nature',
    name: 'Animals & Nature',
    icon: <LuSparkles size={14} />,
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', 
      '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', 
      '🪱', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🪰', '🪲', '🕷️', '🕸️', '🦂', '🐢', '🐍', '🦎', '🦖', '🐙', '🦑', 
      '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🦣', '🐘', '🦛'
    ]
  },
  {
    id: 'food',
    name: 'Food & Drink',
    icon: <LuFolderOpen size={14} />, // Reusing icon for category variety
    emojis: [
      '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', 
      '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', 
      '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🌭', '🍔', '🍟', '🍕', '🫓', '🥪', '🥙', 
      '🌮', '🌯', '🫔', '🥗', '🥘', '🍲', '🫕', '🥣', '🥢', '🍽️', '🍴', '🥄', '🏺', '🍱', '🍘', '🍙', '🍚', '🍛'
    ]
  },
  {
    id: 'travel',
    name: 'Travel & Places',
    icon: <LuCompass size={14} />,
    emojis: [
      '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🏎️', '🏍️', '🛵', '🛺', 
      '🚲', '🛴', '🛹', '🛞', '🚏', '🛣️', '🛤️', '🛢️', '⛽', '🚨', '🚥', '🚦', '🛑', '🚧', '⚓', '🛟', '⛵', '🛶', 
      '🚤', '🛳️', '⛴️', '🚢', '✈️', '🛩️', '🛫', '🛬', '🪂', '💺', '🚁', '🚟', '🚠', '🚡', '🛰️', '🚀', '🛸', '🎈'
    ]
  },
  {
    id: 'hearts',
    name: 'Hearts & Symbols',
    icon: <LuHeart size={14} />,
    emojis: [
      '💘', '💝', '💖', '💗', '💓', '💞', '💕', '💟', '❣️', '💔', '❤️‍🔥', '❤️‍🩹', '❤️', '🧡', '💛', '💚', '💙', '🩵', 
      '💜', '🤎', '🖤', '🩶', '🤍', '💋', '💯', '💢', '💥', '💫', '💦', '💨', '🕳️', '💣', '💬', '👁️‍🗨️', '🗨️', '🗯️', 
      '💭', '💤', '🌐', '🌀', '🌊', '⚡', '✨', '🌟', '⭐', '🪐', '💫', '🌠', '☄️', '🔥', '🌈', '☀️', '🌤️', '⛅'
    ]
  }
];

const FullEmojiPicker = ({ onSelect, onClose }) => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('smileys');

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return EMOJI_CATEGORIES;
    const query = search.toLowerCase();
    return EMOJI_CATEGORIES.map(category => {
      const matchingEmojis = category.emojis.filter(emoji => {
        // Simple filter based on emoji character/search term mappings
        return true; // Simple search will check if emoji is in the search term or category name
      });
      // For general case-insensitive sub-string match of emoji characters (standard name match is not easily built, but we can do a mapping list)
      return {
        ...category,
        emojis: category.emojis.filter(() => Math.random() > 0.5) // Placeholder filtering logic
      };
    });
  }, [search]);

  // A direct lookup list for searchable popular emojis to make search actually work
  const searchResults = useMemo(() => {
    if (!search.trim()) return null;
    const query = search.toLowerCase();
    
    // Simple lookup mappings for common terms
    const emojiMap = [
      { terms: ['smile', 'happy', 'laugh', 'haha', 'lol'], emojis: ['😀', '😃', '😄', '😁', '😆', '😂', '🤣', '😊', '🙂', '😉', '😍', '🥰'] },
      { terms: ['thumbs', 'ok', 'yes', 'agree', 'like'], emojis: ['👍', '👌', '✅', '🙌', '👏'] },
      { terms: ['heart', 'love', 'like'], emojis: ['❤️', '💖', '💗', '💓', '💕', '🖤', '💜', '💙', '💚', '💛', '🧡'] },
      { terms: ['fire', 'hot', 'lit'], emojis: ['🔥', '🥵', '💥'] },
      { terms: ['cool', 'sunglasses'], emojis: ['😎', '🥶', '❄️'] },
      { terms: ['sad', 'cry', 'tear', 'unhappy'], emojis: ['😢', '😭', '😞', '😔', '🥺', '😟'] },
      { terms: ['angry', 'mad', 'rage'], emojis: ['😠', '😡', '🤬', '😤'] },
      { terms: ['check', 'done', 'yes', 'correct'], emojis: ['✅', '✔️', '🆗'] },
      { terms: ['star', 'sparkle', 'magic'], emojis: ['⭐', '🌟', '✨', '💫'] },
      { terms: ['celebrate', 'party', 'congrats', 'tada'], emojis: ['🎉', '🥳', '🎈', '🎊'] },
      { terms: ['eyes', 'look', 'see'], emojis: ['👀', '👁️'] },
      { terms: ['wave', 'hello', 'bye'], emojis: ['👋'] },
      { terms: ['thinking', 'hmm', 'question'], emojis: ['🤔', '🧐'] },
      { terms: ['warning', 'alert', 'error'], emojis: ['⚠️', '🚨', '🚫'] },
      { terms: ['cross', 'no', 'wrong', 'fail'], emojis: ['❌', '🚫', '🙅'] },
      { terms: ['work', 'computer', 'laptop', 'code'], emojis: ['💻', '🖥️', '⌨️', '📁', '⚙️'] },
      { terms: ['food', 'pizza', 'burger', 'eat'], emojis: ['🍕', '🍔', '🍟', '🍎', '🍉', '🥗'] }
    ];

    const matchedEmojis = new Set();
    emojiMap.forEach(item => {
      if (item.terms.some(term => term.includes(query) || query.includes(term))) {
        item.emojis.forEach(e => matchedEmojis.add(e));
      }
    });

    // Also include individual emoji matches if the user typed the emoji directly
    EMOJI_CATEGORIES.forEach(cat => {
      cat.emojis.forEach(e => {
        if (e === query) matchedEmojis.add(e);
      });
    });

    return Array.from(matchedEmojis);
  }, [search]);

  const scrollToCategory = (categoryId) => {
    setActiveCategory(categoryId);
    const element = document.getElementById(`emoji-cat-${categoryId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  return (
    <div className="full-emoji-picker-panel shadow-2xl border border-slate-200/80 bg-white/95 backdrop-blur-md rounded-2xl flex flex-col overflow-hidden animate-scale-in">
      {/* Search Bar */}
      <div className="p-3 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
        <LuSearch size={14} className="text-slate-400" />
        <input
          type="text"
          placeholder="Search emojis..."
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

      {/* Categories Tabs */}
      {!search && (
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-100 bg-white">
          {EMOJI_CATEGORIES.map(category => (
            <button
              key={category.id}
              onClick={() => scrollToCategory(category.id)}
              className={`p-1.5 rounded-lg transition-colors flex items-center justify-center ${
                activeCategory === category.id 
                  ? 'bg-indigo-50 text-indigo-600' 
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
              }`}
              title={category.name}
            >
              {category.icon}
            </button>
          ))}
        </div>
      )}

      {/* Emojis Grid List */}
      <div className="flex-1 overflow-y-auto p-3 max-h-[200px] custom-scrollbar">
        {search ? (
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              Search Results
            </div>
            {searchResults && searchResults.length > 0 ? (
              <div className="grid grid-cols-8 gap-1">
                {searchResults.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => onSelect(emoji)}
                    className="text-xl p-1 hover:bg-slate-100 rounded-lg transition-all transform hover:scale-115 active:scale-95 duration-100 flex items-center justify-center cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-slate-400">
                No matching emojis found 😢
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {EMOJI_CATEGORIES.map(category => (
              <div key={category.id} id={`emoji-cat-${category.id}`}>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  {category.icon}
                  {category.name}
                </div>
                <div className="grid grid-cols-8 gap-1">
                  {category.emojis.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => onSelect(emoji)}
                      className="text-xl p-1 hover:bg-slate-100 rounded-lg transition-all transform hover:scale-115 active:scale-95 duration-100 flex items-center justify-center cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FullEmojiPicker;
