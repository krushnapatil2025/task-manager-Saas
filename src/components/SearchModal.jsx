import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import {
  LuSearch, LuX, LuLoader, LuCheck, LuMessageSquare, 
  LuFileText, LuUser, LuArrowRight, LuCornerDownRight, LuCommand
} from 'react-icons/lu';
import { useNavigate } from 'react-router-dom';
import { WorkspaceContext } from '../context/WorkspaceContext';
import { searchAll } from '../services/searchService';
import { formatFileSize } from '../services/fileService';

const SearchModal = ({ isOpen, onClose }) => {
  const { workspace } = useContext(WorkspaceContext);
  const navigate = useNavigate();
  
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({ tasks: [], messages: [], comments: [], files: [], members: [] });
  const [flatResults, setFlatResults] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const inputRef = useRef(null);
  const resultsContainerRef = useRef(null);

  // Reset search when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults({ tasks: [], messages: [], comments: [], files: [], members: [] });
      setFlatResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen]);

  // Debounced search logic
  useEffect(() => {
    if (!query.trim() || query.trim().length < 2 || !workspace?.id) {
      setResults({ tasks: [], messages: [], comments: [], files: [], members: [] });
      setFlatResults([]);
      return;
    }

    setLoading(true);
    const delayDebounce = setTimeout(async () => {
      try {
        const searchData = await searchAll(workspace.id, query);
        setResults(searchData);

        // Flatten results for keyboard navigation
        const flattened = [];
        searchData.tasks.forEach(t => flattened.push({ type: 'task', id: t.id, title: t.title, subtitle: `Status: ${t.status} · Priority: ${t.priority}`, item: t }));
        searchData.members.forEach(m => flattened.push({ type: 'member', id: m.id, title: m.name, subtitle: `Workspace Role: ${m.role || 'Member'}`, item: m }));
        searchData.files.forEach(f => flattened.push({ type: 'file', id: f.id, title: f.file_name, subtitle: `Size: ${formatFileSize(f.file_size)} · From Task: ${f.task?.title || '—'}`, item: f }));
        searchData.comments.forEach(c => flattened.push({ type: 'comment', id: c.id, title: c.content, subtitle: `By ${c.author?.name || 'User'} on Task: ${c.task?.title || '—'}`, item: c }));
        searchData.messages.forEach(m => flattened.push({ type: 'message', id: m.id, title: m.content, subtitle: `In Channel: #${m.room?.name || 'Chat'} · By ${m.sender?.name || 'User'}`, item: m }));
        
        setFlatResults(flattened);
        setSelectedIndex(0);
      } catch (err) {
        console.error("Search failure:", err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [query, workspace?.id]);

  // Action execution for a search result
  const handleSelect = useCallback((item) => {
    if (!item) return;
    onClose();

    switch (item.type) {
      case 'task':
        navigate(`/user/task-details/${item.id}`);
        break;
      case 'comment':
        if (item.item.task_id) {
          navigate(`/user/task-details/${item.item.task_id}`);
        }
        break;
      case 'member':
        navigate(`/user/profile`); // Or details if profile page handles other users
        break;
      case 'file':
        if (item.item.public_url) {
          window.open(item.item.public_url, '_blank', 'noopener,noreferrer');
        }
        break;
      case 'message':
        navigate(`/chat`); // In future, can route to `/chat/room/${item.item.room_id}` if routes exist
        break;
      default:
        break;
    }
  }, [navigate, onClose]);

  // Keyboard navigation & Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (flatResults.length > 0 ? (prev + 1) % flatResults.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (flatResults.length > 0 ? (prev - 1 + flatResults.length) % flatResults.length : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (flatResults[selectedIndex]) {
          handleSelect(flatResults[selectedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, flatResults, selectedIndex, handleSelect, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const container = resultsContainerRef.current;
    const selectedElement = container?.querySelector(`[data-index="${selectedIndex}"]`);
    if (container && selectedElement) {
      const containerTop = container.scrollTop;
      const containerBottom = containerTop + container.clientHeight;
      const elemTop = selectedElement.offsetTop;
      const elemBottom = elemTop + selectedElement.clientHeight;

      if (elemTop < containerTop) {
        container.scrollTop = elemTop;
      } else if (elemBottom > containerBottom) {
        container.scrollTop = elemBottom - container.clientHeight;
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const hasResults = flatResults.length > 0;

  return (
    <>
      {/* Backdrop with Blur */}
      <div 
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9990] transition-opacity duration-200"
        onClick={onClose}
      />

      {/* Main Spotlight Search Dialog */}
      <div className="fixed top-[15vh] left-1/2 -translate-x-1/2 w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-[9995] overflow-hidden flex flex-col max-h-[70vh] animate-scale-in">
        
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-25 dark:bg-slate-950/20">
          <LuSearch className="text-slate-400 dark:text-slate-500 w-5 h-5 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks, comments, messages, files and members..."
            className="flex-1 bg-transparent border-none outline-none text-slate-800 dark:text-slate-100 text-sm placeholder:text-slate-400 placeholder:dark:text-slate-600"
          />
          {loading && <LuLoader className="animate-spin text-indigo-500 w-4 h-4 flex-shrink-0" />}
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <LuX className="w-4 h-4" />
          </button>
        </div>

        {/* Results Container */}
        <div 
          ref={resultsContainerRef}
          className="flex-1 overflow-y-auto p-2 min-h-[100px] max-h-[450px]"
        >
          {query.trim().length < 2 ? (
            <div className="py-12 text-center text-slate-400 dark:text-slate-600">
              <LuSearch className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs font-semibold uppercase tracking-wider">Type at least 2 characters to search</p>
            </div>
          ) : !loading && !hasResults ? (
            <div className="py-12 text-center text-slate-400 dark:text-slate-600">
              <p className="text-sm font-medium">No results found for "{query}"</p>
              <p className="text-xs mt-1">Try searching for other keywords, names, or file names.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {results.tasks.length > 0 && (
                <div className="mb-2">
                  <div className="px-3 py-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Tasks</div>
                  {results.tasks.map((task) => {
                    const flatIdx = flatResults.findIndex(r => r.type === 'task' && r.id === task.id);
                    return renderResultItem('task', task.id, task.title, `Status: ${task.status} · Priority: ${task.priority}`, LuCheck, flatIdx);
                  })}
                </div>
              )}

              {results.members.length > 0 && (
                <div className="mb-2">
                  <div className="px-3 py-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Team Members</div>
                  {results.members.map((member) => {
                    const flatIdx = flatResults.findIndex(r => r.type === 'member' && r.id === member.id);
                    return renderResultItem('member', member.id, member.name, `Role: ${member.role || 'Member'}`, LuUser, flatIdx, member.profileImageUrl);
                  })}
                </div>
              )}

              {results.files.length > 0 && (
                <div className="mb-2">
                  <div className="px-3 py-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Files</div>
                  {results.files.map((file) => {
                    const flatIdx = flatResults.findIndex(r => r.type === 'file' && r.id === file.id);
                    return renderResultItem('file', file.id, file.file_name, `Size: ${formatFileSize(file.file_size)} · From Task: ${file.task?.title || '—'}`, LuFileText, flatIdx);
                  })}
                </div>
              )}

              {results.comments.length > 0 && (
                <div className="mb-2">
                  <div className="px-3 py-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Task Comments</div>
                  {results.comments.map((comment) => {
                    const flatIdx = flatResults.findIndex(r => r.type === 'comment' && r.id === comment.id);
                    return renderResultItem('comment', comment.id, comment.content, `By ${comment.author?.name || 'User'} on Task: ${comment.task?.title || '—'}`, LuMessageSquare, flatIdx);
                  })}
                </div>
              )}

              {results.messages.length > 0 && (
                <div className="mb-2">
                  <div className="px-3 py-1 text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">Chat Messages</div>
                  {results.messages.map((msg) => {
                    const flatIdx = flatResults.findIndex(r => r.type === 'message' && r.id === msg.id);
                    return renderResultItem('message', msg.id, msg.content, `In Channel: #${msg.room?.name || 'Chat'} · By ${msg.sender?.name || 'User'}`, LuMessageSquare, flatIdx);
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer info bar */}
        <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-25 dark:bg-slate-950/30 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 font-semibold select-none">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><LuCommand size={10} /> + P or Shift+Ctrl+F</span>
            <span>·</span>
            <span>↑↓ to navigate</span>
            <span>·</span>
            <span>Enter to select</span>
          </div>
          <span>Press ESC to close</span>
        </div>

      </div>
    </>
  );

  // Render function for individual item (to keep layout clean)
  function renderResultItem(type, id, title, subtitle, IconComponent, flatIdx, imageUrl = null) {
    const isSelected = selectedIndex === flatIdx;
    return (
      <div
        key={`${type}-${id}`}
        data-index={flatIdx}
        onClick={() => handleSelect(flatResults[flatIdx])}
        className={`flex items-center gap-3 px-3 py-2 rounded-xl transition duration-150 cursor-pointer select-none ${
          isSelected 
            ? 'bg-indigo-50/70 dark:bg-indigo-950/20 text-indigo-900 dark:text-indigo-200' 
            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300'
        }`}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="w-7 h-7 rounded-full object-cover border border-slate-200 dark:border-slate-700 flex-shrink-0"
          />
        ) : (
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
            isSelected 
              ? 'bg-indigo-100/80 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400' 
              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
          }`}>
            <IconComponent className="w-4 h-4" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold truncate leading-normal">{title}</p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">{subtitle}</p>
        </div>
        {isSelected && (
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
            <span>Open</span>
            <LuArrowRight className="w-3.5 h-3.5" />
          </div>
        )}
      </div>
    );
  }
};

export default SearchModal;
