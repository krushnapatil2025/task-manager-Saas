import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { getPublicBoard, checkPublicLinkStatus } from '../services/publicBoardService';
import {
  LuLock,
  LuLoaderCircle,
  LuCalendar,
  LuCircleAlert,
  LuRefreshCw,
  LuFlag,
  LuFolderClosed
} from 'react-icons/lu';
import moment from 'moment';
import toast from 'react-hot-toast';

const COLUMNS = [
  { id: 'Pending',     label: 'Pending',     color: 'bg-indigo-500',  light: 'bg-white border-slate-200 shadow-sm' },
  { id: 'In Progress', label: 'In Progress', color: 'bg-amber-500',   light: 'bg-white border-slate-200 shadow-sm' },
  { id: 'Completed',   label: 'Completed',   color: 'bg-emerald-500', light: 'bg-white border-slate-200 shadow-sm' },
];

const PRIORITY_COLOR = {
  high:   'text-red-750 bg-red-50 border border-red-200/50',
  medium: 'text-amber-700 bg-amber-50 border border-amber-250/60',
  low:    'text-indigo-700 bg-indigo-50 border border-indigo-200/40',
};

const PublicBoard = () => {
  const { token } = useParams();
  
  const [status, setStatus] = useState(null); // { exists, requiresPassword, isExpired }
  const [password, setPassword] = useState('');
  const [boardData, setBoardData] = useState(null); // { workspace_name, sprint_title, tasks }
  const [loading, setLoading] = useState(true);
  const [passwordError, setPasswordError] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState(null);

  // 1. Check link validity and password requirement
  const verifyLinkStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await checkPublicLinkStatus(token);
      setStatus(res);
      
      if (res.exists && !res.isExpired && !res.requiresPassword) {
        // Automatically fetch if no password is required
        const data = await getPublicBoard(token);
        setBoardData(data);
        setLastRefreshed(new Date());
      }
    } catch (err) {
      console.error('Verify link error:', err);
      toast.error('Failed to connect to board');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    verifyLinkStatus();
  }, [verifyLinkStatus]);

  // 2. Password submit handler
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setPasswordError('');
    try {
      const data = await getPublicBoard(token, password);
      setBoardData(data);
      setLastRefreshed(new Date());
      toast.success('Access granted!');
    } catch (err) {
      console.error('Password verification error:', err);
      setPasswordError(err.message || 'Incorrect password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Manual refresh
  const handleRefresh = async () => {
    try {
      const data = await getPublicBoard(token, password || null);
      setBoardData(data);
      setLastRefreshed(new Date());
      toast.success('Board refreshed!');
    } catch (err) {
      console.error('Refresh error:', err);
      toast.error('Failed to refresh task details');
    }
  };

  // Loading Screen
  if (loading && !boardData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-25 gap-3">
        <LuLoaderCircle className="text-indigo-500 text-3xl animate-spin" />
        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Loading Shared Board...</p>
      </div>
    );
  }

  // Not Found / Expired Screen
  if (!status?.exists || status?.isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-25 px-4">
        <div className="bg-white rounded-3xl border border-slate-200/60 p-8 max-w-sm w-full text-center shadow-xl">
          <div className="w-14 h-14 bg-rose-50 border border-rose-100 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <LuCircleAlert size={26} />
          </div>
          <h3 className="text-sm font-extrabold text-slate-800">
            {status?.isExpired ? 'Board Access Expired' : 'Board Not Found'}
          </h3>
          <p className="text-xs text-slate-450 mt-2.5 leading-relaxed font-semibold">
            {status?.isExpired
              ? 'This public board link has passed its scheduled expiry date and is no longer active.'
              : 'The requested share link is invalid or may have been deleted by the owner.'}
          </p>
        </div>
      </div>
    );
  }

  // Password Lock Screen
  if (status?.requiresPassword && !boardData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-25 px-4">
        <div className="bg-white rounded-3xl border border-slate-200/60 p-8 max-w-md w-full shadow-xl">
          <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 text-indigo-650 rounded-2xl flex items-center justify-center mb-5">
            <LuLock size={22} />
          </div>
          <h3 className="text-sm font-extrabold text-slate-800 mb-1">
            Password Protected Board
          </h3>
          <p className="text-xs text-slate-450 leading-relaxed font-semibold mb-6">
            Access to this shared task board is restricted. Please enter the password provided by your team lead.
          </p>

          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
            <div>
              <input
                type="password"
                placeholder="Enter board password..."
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 text-xs font-semibold text-slate-700 bg-slate-25 rounded-xl border border-slate-200 outline-none focus:border-indigo-500 transition"
                required
              />
              {passwordError && (
                <p className="text-[10px] text-red-500 font-bold mt-1.5">{passwordError}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-750 disabled:opacity-50 text-white text-xs font-bold py-2.5 rounded-xl shadow-lg shadow-indigo-150 transition cursor-pointer"
            >
              {loading ? 'Verifying...' : 'Unlock Board'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Group tasks by status
  const tasks = boardData?.tasks || [];
  const columnsData = {
    'Pending':     tasks.filter(t => t.status === 'Pending'),
    'In Progress': tasks.filter(t => t.status === 'In Progress'),
    'Completed':   tasks.filter(t => t.status === 'Completed'),
  };

  return (
    <div className="min-h-screen bg-slate-25 flex flex-col font-sans">
      
      {/* Navbar Header banner */}
      <header className="bg-[#0c0c0e] border-b border-[#1c1c20] text-white px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-0 z-10">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-400 bg-indigo-950/45 px-2 py-0.5 rounded border border-indigo-900/50">
              Shared Board
            </span>
            {boardData?.sprint_title && (
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-450 bg-emerald-950/45 px-2 py-0.5 rounded border border-emerald-900/50">
                Sprint: {boardData.sprint_title}
              </span>
            )}
          </div>
          <h1 className="text-base font-extrabold text-slate-100 tracking-tight mt-1 flex items-center gap-1.5">
            <LuFolderClosed className="text-slate-450" size={16} /> {boardData?.workspace_name}
          </h1>
        </div>

        {/* Refresh & status metrics */}
        <div className="flex items-center gap-3">
          {lastRefreshed && (
            <span className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">
              Updated: {moment(lastRefreshed).format('h:mm A')}
            </span>
          )}
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 bg-[#1c1c20] hover:bg-neutral-800 border border-[#2c2c32] text-slate-200 text-xs font-bold px-3 py-1.5 rounded-xl shadow-md transition cursor-pointer"
          >
            <LuRefreshCw size={13} /> Refresh
          </button>
        </div>
      </header>

      {/* Board Columns container */}
      <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {COLUMNS.map(col => {
            const colTasks = columnsData[col.id] || [];
            return (
              <div key={col.id} className="flex flex-col min-h-[400px]">
                {/* Column header */}
                <div className={`flex items-center justify-between px-4 py-3 rounded-2xl ${col.light} border border-slate-200/60 mb-4`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${col.color} shadow-sm`} />
                    <span className="font-extrabold text-sm text-slate-800 tracking-tight">{col.label}</span>
                  </div>
                  <span className="text-xs font-extrabold text-slate-500 bg-slate-50 border border-slate-200/50 rounded-full px-2.5 py-0.5">
                    {colTasks.length}
                  </span>
                </div>

                {/* Tasks List */}
                <div className="flex flex-col gap-4 p-1">
                  {colTasks.map(task => {
                    const totalCount = task.todo_checklist?.length || 0;
                    return (
                      <div
                        key={task.id}
                        className="bg-white rounded-2xl border border-slate-200/70 p-4 shadow-sm hover:shadow-md transition duration-200 flex flex-col"
                      >
                        {/* Priority Badge */}
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-md capitalize flex items-center gap-1 ${PRIORITY_COLOR[task.priority]}`}>
                            <LuFlag size={10} />
                            {task.priority}
                          </span>
                        </div>

                        {/* Title & Desc */}
                        <h4 className="font-extrabold text-sm text-slate-800 mb-1 leading-snug">
                          {task.title}
                        </h4>
                        <p className="text-xs text-slate-400 line-clamp-2 mb-3 font-medium">
                          {task.description}
                        </p>

                        {/* Progress Bar (if checklists or custom progress) */}
                        {task.progress > 0 && (
                          <div className="mb-3">
                            <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                              <span>Progress</span>
                              <span>{task.progress}%</span>
                            </div>
                            <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-indigo-500 rounded-full"
                                style={{ width: `${task.progress}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Footer details */}
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                          {task.due_date ? (
                            <span className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                              <LuCalendar size={11} />
                              {moment(task.due_date).format('MMM D')}
                            </span>
                          ) : (
                            <span />
                          )}

                          {/* Assignee Avatars */}
                          <div className="flex -space-x-1.5">
                            {task.assignees?.slice(0, 3).map((u, i) =>
                              u.profile_image_url ? (
                                <img
                                  key={i}
                                  src={u.profile_image_url}
                                  alt={u.name}
                                  className="w-5 h-5 rounded-full border border-white object-cover shadow-sm"
                                  title={u.name}
                                />
                              ) : (
                                <div
                                  key={i}
                                  className="w-5 h-5 rounded-full border border-white bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm"
                                  title={u.name}
                                >
                                  <span className="text-white text-[8px] font-extrabold">
                                    {u.name?.[0]?.toUpperCase()}
                                  </span>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {colTasks.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 rounded-2xl border-2 border-dashed border-slate-200 bg-white/50">
                      <p className="text-[10px] text-slate-450 font-bold uppercase tracking-wider">No Tasks</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Footer Branding */}
      <footer className="py-6 border-t border-slate-200/50 bg-white text-center flex flex-col sm:flex-row items-center justify-between px-8 gap-2 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
        <p>© 2026 strideo . All rights reserved.</p>
        <p>Built by <a href="https://www.cicdtech.in/" target="_blank" rel="noopener noreferrer" className="text-indigo-650 hover:underline">CICD Tech</a></p>
      </footer>
    </div>
  );
};

export default PublicBoard;
