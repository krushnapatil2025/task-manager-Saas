import React, { useState } from 'react';
import { LuX, LuCopy, LuCheck, LuLock, LuCalendar, LuGlobe, LuShare2, LuEye, LuEyeOff } from 'react-icons/lu';
import { createPublicLink } from '../services/publicBoardService';
import toast from 'react-hot-toast';

const ShareBoardModal = ({ isOpen, onClose, workspaceId, sprintId = null, sprintName = null }) => {
  if (!isOpen) return null;

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const data = await createPublicLink(workspaceId, sprintId, password, expiresAt || null);
      const fullUrl = `${window.location.origin}/public-board/${data.token}`;
      setGeneratedLink(fullUrl);
      toast.success('Public board link generated!');
    } catch (err) {
      console.error('Error generating link:', err);
      toast.error('Failed to generate share link');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    toast.success('Link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative bg-white rounded-3xl overflow-hidden shadow-2xl max-w-md w-full border border-slate-100 p-6 animate-scale-in">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-650 hover:bg-slate-50 rounded-xl transition cursor-pointer"
        >
          <LuX size={18} />
        </button>

        {/* Title */}
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center text-indigo-650">
            <LuShare2 size={20} />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-800">
              Share Task Board
            </h3>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5 uppercase tracking-wider">
              {sprintName ? `Sprint: ${sprintName}` : 'Entire Workspace Board'}
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed font-semibold mb-6">
          Generate a secure, read-only link to share real-time progress with clients and external stakeholders. They won't need to log in.
        </p>

        {/* Settings Form */}
        {!generatedLink ? (
          <div className="flex flex-col gap-4">
            
            {/* Expiry Date */}
            <div>
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                <LuCalendar size={11} /> Expiry Date (Optional)
              </label>
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={e => setExpiresAt(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-25 rounded-xl border border-slate-200 outline-none focus:border-indigo-500 transition"
              />
            </div>

            {/* Password Access */}
            <div>
              <label className="text-[10px] text-slate-400 dark:text-zinc-550 font-bold uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                <LuLock size={11} /> Password Protection (Optional)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Set password for access..."
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-3.5 pr-10 py-2.5 text-xs font-semibold text-slate-700 dark:text-zinc-200 bg-slate-25 dark:bg-zinc-900/60 rounded-xl border border-slate-200 dark:border-zinc-800 outline-none focus:border-indigo-500 transition"
                />
                {password && (
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition cursor-pointer"
                  >
                    {showPassword ? <LuEyeOff size={14} /> : <LuEye size={14} />}
                  </button>
                )}
              </div>
            </div>

             {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="card-btn-fill w-full flex items-center justify-center gap-2 mt-2 py-2.5 rounded-xl cursor-pointer"
            >
              <LuGlobe size={14} /> {loading ? 'Generating Link...' : 'Create Public Link'}
            </button>
          </div>
        ) : (
          /* Link Generated Result view */
          <div className="flex flex-col gap-4">
            <div className="bg-emerald-50 border border-emerald-200/50 rounded-2xl p-4 text-center">
              <span className="text-emerald-700 text-xs font-bold block">✓ Board Link Active</span>
              <p className="text-[10px] text-emerald-600 font-semibold mt-1">
                Live board is now accessible to anyone with this URL.
              </p>
            </div>

            {/* Copy Field */}
            <div className="relative">
              <input
                type="text"
                readOnly
                value={generatedLink}
                className="w-full pl-3 pr-20 py-2.5 text-xs font-bold text-slate-700 bg-slate-25 border border-slate-200 rounded-xl outline-none select-all"
              />
              <button
                onClick={handleCopy}
                className="card-btn-fill absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-lg cursor-pointer"
              >
                {copied ? <LuCheck size={11} /> : <LuCopy size={11} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>

            {/* Clear Link Button */}
            <button
              onClick={() => {
                setGeneratedLink('');
                setPassword('');
                setExpiresAt('');
              }}
              className="text-xs font-bold text-slate-400 hover:text-slate-600 transition text-center mt-2 cursor-pointer"
            >
              Configure another link
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShareBoardModal;
