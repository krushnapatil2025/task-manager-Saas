import React, { useState, useEffect, useContext } from 'react';
import { WorkspaceContext } from '../../context/WorkspaceContext';
import { UserContext } from '../../context/userContext';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import RefreshButton from '../../components/RefreshButton';
import { 
  getTodayLog, 
  saveLog, 
  getInternLogHistory,
  updateInternLog
} from '../../services/internLogService';
import InternLogComments from '../../components/InternLogComments';
import { supabase } from '../../utils/supabaseClient';
import toast from 'react-hot-toast';
import { 
  LuPlus, 
  LuTrash2, 
  LuFileText, 
  LuTriangleAlert, 
  LuCircleCheckBig, 
  LuCircleHelp, 
  LuCalendar,
  LuLoader,
  LuClock,
  LuBookOpen,
  LuChevronRight,
  LuChevronLeft,
  LuCornerDownRight,
  LuFlame,
  LuTrendingUp,
  LuMessageSquare
} from 'react-icons/lu';

const AVAILABLE_TAGS = ['Frontend', 'Backend', 'Design', 'Research', 'Meeting', 'Bug Fix', 'Documentation', 'Other'];

const InternDailyLog = () => {
  const { workspace, wsRole } = useContext(WorkspaceContext);
  const { user } = useContext(UserContext);

  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [todayLog, setTodayLog] = useState(null);
  const [logCommentCounts, setLogCommentCounts] = useState({});

  // Form State
  const [tasks, setTasks] = useState([]);
  const [learnings, setLearnings] = useState('');
  const [blockers, setBlockers] = useState('');
  const [tomorrowPlan, setTomorrowPlan] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [otherTagText, setOtherTagText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // States for editing past logs in modal
  const [isEditingPastLog, setIsEditingPastLog] = useState(false);
  const [pastLogTasks, setPastLogTasks] = useState([]);
  const [pastLogLearnings, setPastLogLearnings] = useState('');
  const [pastLogBlockers, setPastLogBlockers] = useState('');
  const [pastLogTomorrowPlan, setPastLogTomorrowPlan] = useState('');
  const [pastLogTags, setPastLogTags] = useState([]);
  const [pastLogOtherTagText, setPastLogOtherTagText] = useState('');

  // Calendar State
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());

  // Selected past log for viewing details in read-only mode
  const [selectedPastLog, setSelectedPastLog] = useState(null);

  // ── Redirect non-interns ──────────────────────────────────────────────────
  const isIntern = wsRole === 'intern';

  const loadData = async () => {
    if (!workspace?.id || !user?.id || !isIntern) return;
    setLoading(true);
    try {
      // 1. Fetch today's log
      const log = await getTodayLog(user.id, workspace.id);
      setTodayLog(log);

      if (log) {
        setLearnings(log.learnings || '');
        setBlockers(log.blockers || '');
        setTomorrowPlan(log.tomorrow_plan || '');
        setSelectedTags(log.tags || []);
        
        const otherTag = (log.tags || []).find(t => t.startsWith('Other: '));
        if (otherTag) {
          setOtherTagText(otherTag.substring(7));
        } else {
          setOtherTagText('');
        }
        
        try {
          const parsedTasks = typeof log.tasks_done === 'string' 
            ? JSON.parse(log.tasks_done) 
            : (log.tasks_done || []);
          setTasks(parsedTasks);
        } catch (e) {
          setTasks([]);
        }
      } else {
        // Reset form for fresh day
        setTasks([{ title: '', description: '', hours: '1' }]);
        setLearnings('');
        setBlockers('');
        setTomorrowPlan('');
        setSelectedTags([]);
        setOtherTagText('');
      }

      // 2. Fetch history
      const historyData = await getInternLogHistory(user.id, workspace.id);
      setHistory(historyData);

      // 3. Fetch comment counts
      const logIds = historyData.map(h => h.id);
      if (log?.id && !logIds.includes(log.id)) {
        logIds.push(log.id);
      }
      if (logIds.length > 0) {
        const { data: commentCounts, error: countErr } = await supabase
          .from('intern_log_messages')
          .select('log_id')
          .in('log_id', logIds);

        if (!countErr && commentCounts) {
          const counts = {};
          commentCounts.forEach(c => {
            counts[c.log_id] = (counts[c.log_id] || 0) + 1;
          });
          setLogCommentCounts(counts);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load daily log information');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [workspace?.id, user?.id, wsRole]);

  useEffect(() => {
    if (selectedPastLog) {
      setIsEditingPastLog(false);
      setPastLogLearnings(selectedPastLog.learnings || '');
      setPastLogBlockers(selectedPastLog.blockers || '');
      setPastLogTomorrowPlan(selectedPastLog.tomorrow_plan || '');
      setPastLogTags(selectedPastLog.tags || []);
      
      const otherTag = (selectedPastLog.tags || []).find(t => t.startsWith('Other: '));
      if (otherTag) {
        setPastLogOtherTagText(otherTag.substring(7));
      } else {
        setPastLogOtherTagText('');
      }

      try {
        const parsedTasks = typeof selectedPastLog.tasks_done === 'string'
          ? JSON.parse(selectedPastLog.tasks_done)
          : (selectedPastLog.tasks_done || []);
        setPastLogTasks(parsedTasks);
      } catch (e) {
        setPastLogTasks([]);
      }
    }
  }, [selectedPastLog]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleAddTask = () => {
    setTasks(prev => [...prev, { title: '', description: '', hours: '1' }]);
  };

  const handleRemoveTask = (index) => {
    setTasks(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleTaskChange = (index, field, value) => {
    setTasks(prev => prev.map((t, idx) => idx === index ? { ...t, [field]: value } : t));
  };

  const handleToggleTag = (tag) => {
    if (tag === 'Other') {
      const hasOther = selectedTags.includes('Other') || selectedTags.some(t => t.startsWith('Other:'));
      if (hasOther) {
        setSelectedTags(prev => prev.filter(t => t !== 'Other' && !t.startsWith('Other:')));
        setOtherTagText('');
      } else {
        setSelectedTags(prev => [...prev, 'Other']);
      }
    } else {
      setSelectedTags(prev => 
        prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
      );
    }
  };

  const handleAddTaskPast = () => {
    setPastLogTasks(prev => [...prev, { title: '', description: '', hours: '1' }]);
  };

  const handleRemoveTaskPast = (index) => {
    setPastLogTasks(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleTaskChangePast = (index, field, value) => {
    setPastLogTasks(prev => prev.map((t, idx) => idx === index ? { ...t, [field]: value } : t));
  };

  const handleToggleTagPast = (tag) => {
    if (tag === 'Other') {
      const hasOther = pastLogTags.includes('Other') || pastLogTags.some(t => t.startsWith('Other:'));
      if (hasOther) {
        setPastLogTags(prev => prev.filter(t => t !== 'Other' && !t.startsWith('Other:')));
        setPastLogOtherTagText('');
      } else {
        setPastLogTags(prev => [...prev, 'Other']);
      }
    } else {
      setPastLogTags(prev => 
        prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
      );
    }
  };

  const handleSavePast = async () => {
    if (pastLogTasks.length === 0 || pastLogTasks.some(t => !t.title.trim() || !t.hours)) {
      toast.error('Please enter at least one task with a title and hours spent.');
      return;
    }
    if (!pastLogLearnings.trim()) {
      toast.error('Please fill in the learnings section.');
      return;
    }
    const hasOther = pastLogTags.includes('Other') || pastLogTags.some(t => t.startsWith('Other:'));
    if (hasOther && !pastLogOtherTagText.trim()) {
      toast.error('Please enter a custom category name for the Other tag.');
      return;
    }

    setIsSubmitting(true);
    try {
      let finalTags = pastLogTags.filter(t => t !== 'Other' && !t.startsWith('Other:'));
      if (hasOther) {
        finalTags.push('Other');
        if (pastLogOtherTagText.trim()) {
          finalTags.push(`Other: ${pastLogOtherTagText.trim()}`);
        }
      }

      const payload = {
        tasks_done: pastLogTasks,
        learnings: pastLogLearnings,
        blockers: pastLogBlockers,
        tomorrow_plan: pastLogTomorrowPlan,
        tags: finalTags,
        status: 'submitted'
      };

      const updated = await updateInternLog(selectedPastLog.id, payload);
      toast.success('Work log resubmitted successfully! 🚀');
      
      setSelectedPastLog(prev => ({
        ...prev,
        ...updated
      }));
      setIsEditingPastLog(false);
      await loadData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to resubmit work log');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSave = async (statusType) => {
    if (statusType === 'submitted') {
      // Validations
      if (tasks.length === 0 || tasks.some(t => !t.title.trim() || !t.hours)) {
        toast.error('Please enter at least one task with a title and hours spent.');
        return;
      }
      if (!learnings.trim()) {
        toast.error('Please fill in the learnings section.');
        return;
      }
      const hasOther = selectedTags.includes('Other') || selectedTags.some(t => t.startsWith('Other:'));
      if (hasOther && !otherTagText.trim()) {
        toast.error('Please enter a custom category name for the Other tag.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      let finalTags = selectedTags.filter(t => t !== 'Other' && !t.startsWith('Other:'));
      const hasOther = selectedTags.includes('Other') || selectedTags.some(t => t.startsWith('Other:'));
      if (hasOther) {
        finalTags.push('Other');
        if (otherTagText.trim()) {
          finalTags.push(`Other: ${otherTagText.trim()}`);
        }
      }

      const payload = {
        workspace_id: workspace.id,
        user_id: user.id,
        log_date: todayLog?.log_date || new Date().toLocaleDateString('en-CA'),
        tasks_done: tasks,
        learnings,
        blockers,
        tomorrow_plan: tomorrowPlan,
        tags: finalTags,
        status: statusType
      };

      if (todayLog?.id) {
        await updateInternLog(todayLog.id, payload);
      } else {
        await saveLog(payload);
      }
      
      toast.success(statusType === 'submitted' ? 'Daily log submitted successfully! 🚀' : 'Draft saved.');
      await loadData();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save log entry');
    } finally {
      setIsSubmitting(false);
    }
  };
  // ── Streak & calendar helpers ─────────────────────────────────────────────

  const logByDate = history.reduce((acc, l) => { acc[l.log_date] = l; return acc; }, {});

  const computeCurrentStreak = () => {
    let streak = 0;
    const todayStr = new Date().toLocaleDateString('en-CA');
    for (let i = 0; i < 90; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const dow = d.getDay();
      if (dow === 0 || dow === 6) continue;
      const dateStr = d.toLocaleDateString('en-CA');
      const log = logByDate[dateStr];
      if (log && ['submitted', 'acknowledged', 'flagged'].includes(log.status)) {
        streak++;
      } else if (dateStr === todayStr) {
        continue; // today not yet submitted — don't break streak
      } else {
        break;
      }
    }
    return streak;
  };

  const computeLongestStreak = () => {
    const sorted = [...history]
      .filter(l => ['submitted', 'acknowledged', 'flagged'].includes(l.status))
      .sort((a, b) => new Date(a.log_date) - new Date(b.log_date));
    if (sorted.length === 0) return 0;
    let max = 1, cur = 1;
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1].log_date);
      const curr = new Date(sorted[i].log_date);
      const diff = (curr - prev) / 86400000;
      if (diff === 1 || (diff === 3 && prev.getDay() === 5)) { cur++; max = Math.max(max, cur); }
      else cur = 1;
    }
    return max;
  };

  const buildCalendarDays = () => {
    const firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const todayStr = new Date().toLocaleDateString('en-CA');
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = new Date(calendarYear, calendarMonth, d).toLocaleDateString('en-CA');
      const dow = new Date(calendarYear, calendarMonth, d).getDay();
      days.push({ day: d, dateStr, log: logByDate[dateStr] || null, isToday: dateStr === todayStr, isWeekend: dow === 0 || dow === 6, isFuture: dateStr > todayStr });
    }
    return days;
  };

  if (!isIntern) {
    return (
      <DashboardLayout activeMenu="My Daily Log">
        <div className="flex flex-col items-center justify-center py-20 font-sans">
          <LuTriangleAlert className="text-amber-500 mb-3" size={48} />
          <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-100">Access Restricted</h2>
          <p className="text-slate-500 dark:text-zinc-400 mt-2 text-sm max-w-sm text-center">
            This module is reserved exclusively for Interns. Managers and administrators can track intern logs inside the Intern Logs dashboard.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const isTodayLocked = todayLog?.status === 'submitted' || todayLog?.status === 'acknowledged';

  return (
    <DashboardLayout activeMenu="My Daily Log">
      <div className="mt-5 mb-10 font-sans max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-zinc-105 tracking-tight flex items-center gap-2">
              📋 Intern Daily Log
            </h2>
            <p className="text-xs text-slate-450 dark:text-zinc-550 mt-1 font-bold uppercase tracking-wider">
              {workspace?.name} · Submit daily logs for review
            </p>
          </div>
          <div className="flex gap-2">
            <RefreshButton
              id="daily-log-refresh"
              onRefresh={loadData}
              label="Refresh"
              size="sm"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <LuLoader className="animate-spin text-brand" size={32} />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            
            {/* Left/Middle Column: Log Entry Form */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Submission Banner Warning/Success */}
              {!todayLog && (
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 flex items-start gap-3 shadow-sm animate-pulse">
                  <LuTriangleAlert className="text-amber-500 mt-0.5 flex-shrink-0" size={20} />
                  <div>
                    <h4 className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider">Log Required</h4>
                    <p className="text-xs text-amber-700 dark:text-amber-300/80 mt-0.5 leading-relaxed font-semibold">
                      You haven't submitted your daily work log yet. Logs are mandatory before the end of the day.
                    </p>
                  </div>
                </div>
              )}

              {todayLog?.status === 'draft' && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/40 border border-slate-200/60 dark:border-zinc-800 flex items-start gap-3 shadow-sm">
                  <LuFileText className="text-slate-450 mt-0.5 flex-shrink-0" size={20} />
                  <div>
                    <h4 className="text-xs font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider">Saved as Draft</h4>
                    <p className="text-xs text-slate-500 dark:text-zinc-400/80 mt-0.5 leading-relaxed font-semibold">
                      Your today's log is in draft format. Please submit it before the closing hour to avoid a missed flag.
                    </p>
                  </div>
                </div>
              )}

              {todayLog?.status === 'submitted' && (
                <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-150/40 dark:border-indigo-900/30 flex items-start gap-3 shadow-sm">
                  <LuClock className="text-indigo-500 mt-0.5 flex-shrink-0 animate-spin-slow" size={20} />
                  <div>
                    <h4 className="text-xs font-bold text-indigo-750 dark:text-indigo-400 uppercase tracking-wider">Submitted · Pending Review</h4>
                    <p className="text-xs text-brand-text dark:text-indigo-305 mt-0.5 leading-relaxed font-semibold">
                      Great job! Your log has been submitted. A manager will review and acknowledge it shortly.
                    </p>
                  </div>
                </div>
              )}

              {todayLog?.status === 'acknowledged' && (
                <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/15 border border-emerald-150/40 dark:border-emerald-900/30 flex items-start gap-3 shadow-sm">
                  <LuCircleCheckBig className="text-emerald-500 mt-0.5 flex-shrink-0" size={20} />
                  <div>
                    <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider">Log Acknowledged</h4>
                    <p className="text-xs text-emerald-700 dark:text-emerald-305 mt-0.5 leading-relaxed font-semibold">
                      Your work log has been reviewed and acknowledged by {todayLog.reviewer?.name || 'Manager'}.
                    </p>
                    {todayLog.manager_note && (
                      <div className="mt-2 text-xs border-t border-emerald-100/50 pt-2 text-emerald-650 dark:text-emerald-400/90 font-medium italic">
                        " {todayLog.manager_note} "
                      </div>
                    )}
                  </div>
                </div>
              )}

              {todayLog?.status === 'flagged' && (
                <div className="p-4 rounded-2xl bg-rose-50/60 dark:bg-rose-955/10 border border-rose-150/40 dark:border-rose-900/30 flex items-start gap-3 shadow-sm">
                  <LuTriangleAlert className="text-rose-500 mt-0.5 flex-shrink-0" size={20} />
                  <div>
                    <h4 className="text-xs font-bold text-rose-800 dark:text-rose-400 uppercase tracking-wider">Log Flagged for Attention</h4>
                    <p className="text-xs text-rose-700 dark:text-rose-300 mt-0.5 leading-relaxed font-semibold">
                      Your log was reviewed and flagged by {todayLog.reviewer?.name || 'Manager'}. You can check feedback below.
                    </p>
                    {todayLog.manager_note && (
                      <div className="mt-2 text-xs bg-white/50 dark:bg-zinc-950/20 p-2.5 rounded-xl border border-rose-100 dark:border-rose-900/30 text-rose-900 dark:text-rose-300/90 font-bold leading-normal">
                        Feedback: {todayLog.manager_note}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Core Entry Form Card */}
              <div className="card dark:bg-[#151518]/90 dark:border-zinc-800/80 p-5 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
                  <h3 className="text-sm font-extrabold text-slate-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                    📋 Today's Work Summary
                  </h3>
                  <span className="text-xs font-semibold text-slate-450 dark:text-zinc-550">
                    {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                </div>

                {/* 1. Tasks section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                      Tasks Worked On *
                    </label>
                    {!isTodayLocked && (
                      <button
                        onClick={handleAddTask}
                        className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline cursor-pointer"
                      >
                        <LuPlus size={12} /> Add Task
                      </button>
                    )}
                  </div>

                  <div className="space-y-3">
                    {tasks.map((task, idx) => (
                      <div 
                        key={idx} 
                        className="p-3.5 rounded-2xl bg-slate-50/50 dark:bg-zinc-900/40 border border-slate-150/40 dark:border-zinc-800/50 flex flex-col md:flex-row gap-3 items-start relative group"
                      >
                        <div className="flex-1 space-y-2 w-full">
                          <input
                            type="text"
                            placeholder="What task/ticket did you work on? (e.g. #304 Bugfix)"
                            value={task.title}
                            disabled={isTodayLocked}
                            onChange={(e) => handleTaskChange(idx, 'title', e.target.value)}
                            className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-zinc-200 font-bold focus:border-indigo-500 focus:outline-none transition-all"
                          />
                          <textarea
                            placeholder="Briefly describe what you did..."
                            value={task.description}
                            disabled={isTodayLocked}
                            rows={1}
                            onChange={(e) => handleTaskChange(idx, 'description', e.target.value)}
                            className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-slate-650 dark:text-zinc-400 focus:border-indigo-500 focus:outline-none transition-all resize-none"
                          />
                        </div>
                        <div className="flex items-center gap-2 w-full md:w-auto">
                          <div className="flex items-center gap-1 border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1.5 rounded-xl">
                            <span className="text-[10px] font-black uppercase text-slate-400 dark:text-zinc-650 pr-1">Hrs</span>
                            <input
                              type="number"
                              min="0.5"
                              max="12"
                              step="0.5"
                              value={task.hours}
                              disabled={isTodayLocked}
                              onChange={(e) => handleTaskChange(idx, 'hours', e.target.value)}
                              className="w-12 bg-transparent border-none text-xs text-center font-bold text-slate-800 dark:text-zinc-200 focus:outline-none"
                            />
                          </div>
                          {!isTodayLocked && tasks.length > 1 && (
                            <button
                              onClick={() => handleRemoveTask(idx)}
                              className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-955/15 transition cursor-pointer"
                              title="Delete task row"
                            >
                              <LuTrash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Learnings */}
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                    Key Learnings / Concepts Explored Today *
                  </label>
                  <textarea
                    placeholder="What did you learn today? Mentorship takeaways, tech learnings, research findings, etc."
                    value={learnings}
                    disabled={isTodayLocked}
                    rows={3}
                    onChange={(e) => setLearnings(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 text-xs text-slate-700 dark:text-zinc-300 focus:border-indigo-500 focus:outline-none transition-all leading-normal"
                  />
                </div>

                {/* 3. Blockers */}
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                    Blockers or Help Needed <span className="text-[10px] text-slate-400 lowercase font-normal">(optional)</span>
                  </label>
                  <textarea
                    placeholder="Are you stuck on something? Detail any blockers, server errors, or support needed from seniors."
                    value={blockers}
                    disabled={isTodayLocked}
                    rows={2}
                    onChange={(e) => setBlockers(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 text-xs text-slate-700 dark:text-zinc-300 focus:border-indigo-500 focus:outline-none transition-all leading-normal"
                  />
                </div>

                {/* 4. Plan for tomorrow */}
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                    Plan for Tomorrow
                  </label>
                  <textarea
                    placeholder="What do you plan to tackle tomorrow?"
                    value={tomorrowPlan}
                    disabled={isTodayLocked}
                    rows={2}
                    onChange={(e) => setTomorrowPlan(e.target.value)}
                    className="w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 text-xs text-slate-700 dark:text-zinc-300 focus:border-indigo-500 focus:outline-none transition-all leading-normal"
                  />
                </div>

                {/* 5. Tags */}
                <div className="space-y-2">
                  <label className="text-xs font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                    Work Category Tags
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {AVAILABLE_TAGS.map(tag => {
                      const isSelected = tag === 'Other'
                        ? (selectedTags.includes('Other') || selectedTags.some(t => t.startsWith('Other:')))
                        : selectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          disabled={isTodayLocked}
                          onClick={() => handleToggleTag(tag)}
                          className={`px-3 py-1 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                            isSelected
                              ? 'bg-brand border-brand text-white shadow-sm'
                              : 'bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-slate-550 dark:text-zinc-400 hover:border-slate-350 dark:hover:border-zinc-700'
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>

                  {(selectedTags.includes('Other') || selectedTags.some(t => t.startsWith('Other:'))) && (
                    <div className="mt-3 space-y-1.5 animate-fadeIn">
                      <label className="text-[10px] font-black uppercase text-slate-400 dark:text-zinc-550 block">
                        Custom Category Name *
                      </label>
                      <input
                        type="text"
                        placeholder="Enter custom work category (e.g. DevOps, Testing)"
                        value={otherTagText}
                        disabled={isTodayLocked}
                        onChange={(e) => setOtherTagText(e.target.value)}
                        className="w-full md:w-80 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-zinc-205 font-bold focus:border-indigo-500 focus:outline-none transition-all"
                      />
                    </div>
                  )}
                </div>

                {/* Actions Footer */}
                {!isTodayLocked && (
                  <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-zinc-800 pt-4">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleSave('draft')}
                      className="px-4 py-2 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-bold text-slate-700 dark:text-zinc-350 hover:bg-slate-50 dark:hover:bg-zinc-900/40 transition cursor-pointer"
                    >
                      Save Draft
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleSave('submitted')}
                      className="px-5 py-2 bg-brand hover:opacity-90 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/10 transition cursor-pointer flex items-center gap-1.5"
                    >
                      {isSubmitting ? <LuLoader className="animate-spin" size={14} /> : null}
                      {todayLog?.status === 'flagged' ? 'Submit Updates' : 'Submit Log'}
                    </button>
                  </div>
                )}
              </div>

              {/* Real-time Discussion Chat */}
              {todayLog?.id && (
                <div className="card dark:bg-[#151518]/90 dark:border-zinc-800/80 p-5 mt-4">
                  <InternLogComments logId={todayLog.id} />
                </div>
              )}
            </div>

            {/* Right Column: Streak + Calendar + History */}
            <div className="space-y-4">

              {/* ── Streak Stats Cards ── */}
              {(() => {
                const currentStreak = computeCurrentStreak();
                const longestStreak = computeLongestStreak();
                const submitted = history.filter(l => ['submitted','acknowledged','flagged'].includes(l.status)).length;
                // Compliance: submitted / working days since first log
                let workingDays = 0;
                if (history.length > 0) {
                  const first = new Date(history[history.length - 1].log_date);
                  const now = new Date();
                  for (let d = new Date(first); d <= now; d.setDate(d.getDate() + 1)) {
                    const dow = d.getDay();
                    if (dow !== 0 && dow !== 6) workingDays++;
                  }
                }
                const compliance = workingDays > 0 ? Math.round((submitted / workingDays) * 100) : 0;

                return (
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="card dark:bg-[#151518]/90 dark:border-zinc-800/80 p-3 flex items-center gap-2.5 border-b-2 border-b-amber-400">
                      <LuFlame className="text-amber-500 flex-shrink-0" size={20} />
                      <div>
                        <span className="text-[9px] font-black uppercase text-slate-400 dark:text-zinc-550 block">Current Streak</span>
                        <span className="text-lg font-black text-slate-800 dark:text-zinc-100">{currentStreak} <span className="text-xs font-bold text-amber-500">days</span></span>
                      </div>
                    </div>
                    <div className="card dark:bg-[#151518]/90 dark:border-zinc-800/80 p-3 flex items-center gap-2.5 border-b-2 border-b-indigo-400">
                      <LuTrendingUp className="text-indigo-500 flex-shrink-0" size={20} />
                      <div>
                        <span className="text-[9px] font-black uppercase text-slate-400 dark:text-zinc-550 block">Best Streak</span>
                        <span className="text-lg font-black text-slate-800 dark:text-zinc-100">{longestStreak} <span className="text-xs font-bold text-indigo-500">days</span></span>
                      </div>
                    </div>
                    <div className="card dark:bg-[#151518]/90 dark:border-zinc-800/80 p-3 flex items-center gap-2.5 border-b-2 border-b-emerald-400">
                      <LuCircleCheckBig className="text-emerald-500 flex-shrink-0" size={20} />
                      <div>
                        <span className="text-[9px] font-black uppercase text-slate-400 dark:text-zinc-550 block">Total Submitted</span>
                        <span className="text-lg font-black text-slate-800 dark:text-zinc-100">{submitted} <span className="text-xs font-bold text-emerald-500">logs</span></span>
                      </div>
                    </div>
                    <div className="card dark:bg-[#151518]/90 dark:border-zinc-800/80 p-3 flex items-center gap-2.5 border-b-2 border-b-blue-400">
                      <LuClock className="text-blue-500 flex-shrink-0" size={20} />
                      <div>
                        <span className="text-[9px] font-black uppercase text-slate-400 dark:text-zinc-550 block">Compliance</span>
                        <span className="text-lg font-black text-slate-800 dark:text-zinc-100">{compliance}<span className="text-xs font-bold text-blue-500">%</span></span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ── Calendar Heatmap ── */}
              <div className="card dark:bg-[#151518]/90 dark:border-zinc-800/80 p-4">
                {/* Calendar Header */}
                <div className="flex items-center justify-between mb-3">
                  <button
                    onClick={() => {
                      if (calendarMonth === 0) { setCalendarMonth(11); setCalendarYear(y => y - 1); }
                      else setCalendarMonth(m => m - 1);
                    }}
                    className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-400 transition cursor-pointer"
                  >
                    <LuChevronLeft size={14} />
                  </button>
                  <span className="text-xs font-black text-slate-700 dark:text-zinc-200 uppercase tracking-wider">
                    {new Date(calendarYear, calendarMonth).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                  </span>
                  <button
                    onClick={() => {
                      if (calendarMonth === 11) { setCalendarMonth(0); setCalendarYear(y => y + 1); }
                      else setCalendarMonth(m => m + 1);
                    }}
                    className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 dark:text-zinc-400 transition cursor-pointer"
                  >
                    <LuChevronRight size={14} />
                  </button>
                </div>

                {/* Day-of-week headers */}
                <div className="grid grid-cols-7 mb-1">
                  {['S','M','T','W','T','F','S'].map((d, i) => (
                    <div key={i} className="text-center text-[9px] font-black uppercase text-slate-400 dark:text-zinc-600 py-0.5">{d}</div>
                  ))}
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {buildCalendarDays().map((cell, i) => {
                    if (!cell) return <div key={`empty-${i}`} />;
                    const { day, dateStr, log, isToday, isWeekend, isFuture } = cell;

                    let bgClass = 'bg-slate-50 dark:bg-zinc-900/30 text-slate-400 dark:text-zinc-600';
                    let dotColor = '';
                    if (isWeekend) bgClass = 'bg-transparent text-slate-300 dark:text-zinc-800';
                    else if (isFuture) bgClass = 'bg-transparent text-slate-300 dark:text-zinc-800';
                    else if (log) {
                      if (log.status === 'acknowledged') { bgClass = 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'; dotColor = 'bg-emerald-500'; }
                      else if (log.status === 'submitted') { bgClass = 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400'; dotColor = 'bg-blue-500'; }
                      else if (log.status === 'flagged') { bgClass = 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400'; dotColor = 'bg-amber-500'; }
                      else if (log.status === 'missed') { bgClass = 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400'; dotColor = 'bg-rose-500'; }
                      else if (log.status === 'draft') { bgClass = 'bg-slate-100 dark:bg-zinc-800/40 text-slate-600 dark:text-zinc-400'; dotColor = 'bg-slate-400'; }
                    }

                    return (
                      <button
                        key={dateStr}
                        title={log ? `${log.status}` : isWeekend ? 'Weekend' : isFuture ? '' : 'No log'}
                        onClick={() => log && setSelectedPastLog(log)}
                        disabled={!log}
                        className={`relative flex flex-col items-center justify-center rounded-lg aspect-square text-[10px] font-bold transition-all ${bgClass} ${isToday ? 'ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-zinc-950' : ''} ${log ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                      >
                        <span>{day}</span>
                        {dotColor && <span className={`absolute bottom-0.5 w-1 h-1 rounded-full ${dotColor}`} />}
                      </button>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800">
                  {[
                    { color: 'bg-emerald-500', label: 'Acknowledged' },
                    { color: 'bg-blue-500',    label: 'Submitted' },
                    { color: 'bg-amber-500',   label: 'Flagged' },
                    { color: 'bg-rose-500',    label: 'Missed' },
                    { color: 'bg-slate-400',   label: 'Draft' },
                  ].map(({ color, label }) => (
                    <span key={label} className="flex items-center gap-1 text-[9px] font-bold text-slate-400 dark:text-zinc-500">
                      <span className={`w-2 h-2 rounded-full ${color}`} /> {label}
                    </span>
                  ))}
                </div>
              </div>

              {/* ── Recent History ── */}
              <div>
                <h3 className="text-xs font-extrabold text-slate-400 dark:text-zinc-550 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
                  <LuCalendar size={13} /> Recent Logs
                </h3>
                <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1 custom-scrollbar">
                  {history.length === 0 ? (
                    <div className="card text-center py-8 dark:bg-[#151518]/90 dark:border-zinc-800/80">
                      <LuFileText className="mx-auto mb-2 opacity-30 text-indigo-500" size={24} />
                      <p className="text-xs text-slate-450 dark:text-zinc-550 font-bold">No logs yet — submit your first!</p>
                    </div>
                  ) : (
                    history.slice(0, 10).map((log) => {
                      const badgeMap = {
                        draft:        'bg-slate-100 border-slate-200 text-slate-600 dark:bg-zinc-900/60 dark:border-zinc-800 dark:text-zinc-400',
                        submitted:    'bg-blue-50 border-blue-100 text-blue-600 dark:bg-blue-955/20 dark:border-blue-900/50 dark:text-blue-400',
                        acknowledged: 'bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-950/20 dark:border-emerald-900/50 dark:text-emerald-450',
                        flagged:      'bg-amber-50 border-amber-100 text-amber-600 dark:bg-amber-950/20 dark:border-amber-900/50 dark:text-amber-400',
                        missed:       'bg-rose-50 border-rose-100 text-rose-600 dark:bg-rose-955/20 dark:border-rose-900/50 dark:text-rose-400',
                      };
                      return (
                        <button
                          key={log.id}
                          onClick={() => setSelectedPastLog(log)}
                          className="w-full text-left card hover:border-slate-300 dark:hover:border-zinc-700/80 p-3 transition-all flex items-center justify-between gap-2 group dark:bg-[#151518]/90 dark:border-zinc-800/80 cursor-pointer"
                        >
                          <div>
                            <p className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                              {new Date(log.log_date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                            <p className="text-[10px] text-slate-450 dark:text-zinc-550 mt-0.5 flex items-center gap-1 flex-wrap">
                              <LuClock size={9} />
                              {(() => { try { const t = typeof log.tasks_done === 'string' ? JSON.parse(log.tasks_done) : log.tasks_done; return `${t.reduce((s,i) => s + parseFloat(i.hours||0), 0)}h · ${t.length} task${t.length !== 1 ? 's' : ''}`; } catch(e) { return '—'; } })()}
                              {(log.intern_log_messages?.[0]?.count > 0 || logCommentCounts[log.id] > 0) && (
                                <span className="inline-flex items-center gap-0.5 text-indigo-500 dark:text-indigo-400 font-semibold bg-indigo-50 dark:bg-indigo-950/20 px-1.5 py-0.2 rounded border border-indigo-100/30 dark:border-indigo-900/30 text-[8px] uppercase">
                                  <LuMessageSquare size={8} /> {log.intern_log_messages?.[0]?.count || logCommentCounts[log.id]}
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg border ${badgeMap[log.status] || ''}`}>
                              {log.status === 'submitted' ? 'pending' : log.status}
                            </span>
                            <LuChevronRight size={13} className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-zinc-300 transition-all" />
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Read-only details Modal for past log */}
        {selectedPastLog && (
          <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-950 border border-slate-105 dark:border-zinc-850 rounded-2xl max-w-xl w-full shadow-2xl p-5 relative max-h-[85vh] overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-850 pb-3 mb-4">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-2">
                    {isEditingPastLog ? '✏️ Edit Log Details' : '📋 Log Details'}
                  </h3>
                  <p className="text-[10px] text-slate-450 dark:text-zinc-550 font-bold uppercase tracking-wider mt-0.5">
                    {new Date(selectedPastLog.log_date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedPastLog.status === 'flagged' && !isEditingPastLog && (
                    <button
                      onClick={() => setIsEditingPastLog(true)}
                      className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold shadow-md shadow-amber-500/10 transition cursor-pointer"
                    >
                      Edit Log
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setSelectedPastLog(null);
                      setIsEditingPastLog(false);
                    }}
                    className="p-1 px-3 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-900 cursor-pointer text-xs font-bold"
                  >
                    Close
                  </button>
                </div>
              </div>

              {isEditingPastLog ? (
                /* EDIT FORM BODY FOR FLAGGED LOGS */
                <div className="space-y-4 text-xs">
                  {/* Tasks List */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-[10px]">
                        Tasks Logged *
                      </h4>
                      <button
                        onClick={handleAddTaskPast}
                        className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline cursor-pointer"
                      >
                        <LuPlus size={12} /> Add Task
                      </button>
                    </div>
                    
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                      {pastLogTasks.map((task, idx) => (
                        <div 
                          key={idx} 
                          className="p-3.5 rounded-2xl bg-slate-50/50 dark:bg-zinc-900/40 border border-slate-150/40 dark:border-zinc-800/50 flex flex-col gap-2 relative group"
                        >
                          <input
                            type="text"
                            placeholder="What task/ticket did you work on?"
                            value={task.title}
                            onChange={(e) => handleTaskChangePast(idx, 'title', e.target.value)}
                            className="w-full bg-white dark:bg-zinc-950 border border-slate-205 dark:border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-zinc-205 font-bold focus:border-indigo-500 focus:outline-none transition-all"
                          />
                          <textarea
                            placeholder="Briefly describe what you did..."
                            value={task.description}
                            rows={1}
                            onChange={(e) => handleTaskChangePast(idx, 'description', e.target.value)}
                            className="w-full bg-white dark:bg-zinc-950 border border-slate-205 dark:border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-slate-655 dark:text-zinc-400 focus:border-indigo-500 focus:outline-none transition-all resize-none"
                          />
                          <div className="flex justify-between items-center gap-2">
                            <div className="flex items-center gap-1 border border-slate-205 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 py-1 rounded-xl">
                              <span className="text-[10px] font-black uppercase text-slate-400 dark:text-zinc-650 pr-1">Hrs</span>
                              <input
                                type="number"
                                min="0.5"
                                max="12"
                                step="0.5"
                                value={task.hours}
                                onChange={(e) => handleTaskChangePast(idx, 'hours', e.target.value)}
                                className="w-12 bg-transparent border-none text-xs text-center font-bold text-slate-800 dark:text-zinc-200 focus:outline-none"
                              />
                            </div>
                            {pastLogTasks.length > 1 && (
                              <button
                                onClick={() => handleRemoveTaskPast(idx)}
                                className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-955/15 transition cursor-pointer"
                                title="Delete task row"
                              >
                                <LuTrash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Learnings */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                      Key Learnings *
                    </label>
                    <textarea
                      placeholder="What did you learn today?"
                      value={pastLogLearnings}
                      rows={3}
                      onChange={(e) => setPastLogLearnings(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-950 border border-slate-205 dark:border-zinc-800 rounded-xl p-3 text-xs text-slate-700 dark:text-zinc-300 focus:border-indigo-500 focus:outline-none transition-all leading-normal"
                    />
                  </div>

                  {/* Blockers */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                      Blockers or Help Needed
                    </label>
                    <textarea
                      placeholder="Detail blockers, if any..."
                      value={pastLogBlockers}
                      rows={2}
                      onChange={(e) => setPastLogBlockers(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-950 border border-slate-205 dark:border-zinc-800 rounded-xl p-3 text-xs text-slate-700 dark:text-zinc-300 focus:border-indigo-500 focus:outline-none transition-all leading-normal"
                    />
                  </div>

                  {/* Plan for Tomorrow */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                      Plan for Tomorrow
                    </label>
                    <textarea
                      placeholder="What is your plan for tomorrow?"
                      value={pastLogTomorrowPlan}
                      rows={2}
                      onChange={(e) => setPastLogTomorrowPlan(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-950 border border-slate-205 dark:border-zinc-800 rounded-xl p-3 text-xs text-slate-700 dark:text-zinc-300 focus:border-indigo-500 focus:outline-none transition-all leading-normal"
                    />
                  </div>

                  {/* Tags */}
                  <div className="space-y-2">
                    <label className="text-xs font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                      Work Category Tags
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {AVAILABLE_TAGS.map(tag => {
                        const isSelected = tag === 'Other'
                          ? (pastLogTags.includes('Other') || pastLogTags.some(t => t.startsWith('Other:')))
                          : pastLogTags.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => handleToggleTagPast(tag)}
                            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                              isSelected
                                ? 'bg-brand border-brand text-white shadow-sm'
                                : 'bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-slate-550 dark:text-zinc-400 hover:border-slate-350 dark:hover:border-zinc-700'
                            }`}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>

                    {(pastLogTags.includes('Other') || pastLogTags.some(t => t.startsWith('Other:'))) && (
                      <input
                        type="text"
                        placeholder="Enter custom category name"
                        value={pastLogOtherTagText}
                        onChange={(e) => setPastLogOtherTagText(e.target.value)}
                        className="w-full md:w-80 bg-white dark:bg-zinc-950 border border-slate-205 dark:border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-slate-805 dark:text-zinc-200 font-bold focus:border-indigo-500 focus:outline-none transition-all"
                      />
                    )}
                  </div>

                  {/* Save Footer */}
                  <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-zinc-800 pt-4">
                    <button
                      type="button"
                      onClick={() => setIsEditingPastLog(false)}
                      className="px-4 py-2 border border-slate-200 dark:border-zinc-800 rounded-xl text-xs font-bold text-slate-700 dark:text-zinc-350 hover:bg-slate-50 dark:hover:bg-zinc-900/40 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={handleSavePast}
                      className="px-5 py-2 bg-brand hover:opacity-90 text-white rounded-xl text-xs font-bold shadow-md transition cursor-pointer flex items-center gap-1.5"
                    >
                      {isSubmitting ? <LuLoader className="animate-spin" size={14} /> : null}
                      Submit Updates
                    </button>
                  </div>
                </div>
              ) : (
                /* READ-ONLY DISPLAY BODY */
                <div className="space-y-4 text-xs">
                  {/* Status Block */}
                  <div className="flex items-center justify-between bg-slate-50/80 dark:bg-zinc-900/40 p-3 rounded-xl border border-slate-150/40 dark:border-zinc-850/50">
                    <span className="font-bold text-slate-500 dark:text-zinc-400">Submission Status</span>
                    <span className="text-[9px] font-black uppercase px-2.5 py-0.5 rounded-lg border bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300">
                      {selectedPastLog.status === 'submitted' ? 'pending review' : selectedPastLog.status}
                    </span>
                  </div>

                  {/* Tasks List */}
                  <div className="space-y-2">
                    <h4 className="font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-[10px]">
                      Tasks Logged
                    </h4>
                    <div className="space-y-2">
                      {(() => {
                        try {
                          const parsed = typeof selectedPastLog.tasks_done === 'string' 
                            ? JSON.parse(selectedPastLog.tasks_done) 
                            : selectedPastLog.tasks_done;
                          
                          if (!parsed || parsed.length === 0) {
                            return <p className="text-slate-400 italic">No tasks logged.</p>;
                          }

                          return parsed.map((t, idx) => (
                            <div key={idx} className="p-3 bg-slate-50/50 dark:bg-zinc-900/20 border border-slate-100 dark:border-zinc-900 rounded-xl space-y-1">
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-slate-800 dark:text-zinc-200">{t.title}</span>
                                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-900/30 px-1.5 py-0.5 rounded-md">{t.hours} hrs</span>
                              </div>
                              {t.description && (
                                <p className="text-slate-500 dark:text-zinc-400 text-xs mt-1 leading-normal pl-2 border-l border-slate-200 dark:border-zinc-800">{t.description}</p>
                              )}
                            </div>
                          ));
                        } catch (e) {
                          return <p className="text-rose-500">Failed to parse tasks data.</p>;
                        }
                      })()}
                    </div>
                  </div>

                  {/* Learnings */}
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-[10px]">
                      Key Learnings
                    </h4>
                    <p className="p-3.5 bg-slate-50/30 dark:bg-zinc-900/20 border border-slate-100 dark:border-zinc-900 rounded-xl text-slate-700 dark:text-zinc-300 leading-relaxed">
                      {selectedPastLog.learnings || <span className="text-slate-400 italic">None logged.</span>}
                    </p>
                  </div>

                  {/* Blockers */}
                  {selectedPastLog.blockers && (
                    <div className="space-y-1">
                      <h4 className="font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-[10px] flex items-center gap-1 text-rose-600 dark:text-rose-455">
                        Blockers / Challenges
                      </h4>
                      <p className="p-3.5 bg-rose-50/20 dark:bg-rose-955/5 border border-rose-100/30 dark:border-rose-900/20 rounded-xl text-slate-700 dark:text-zinc-350 leading-relaxed font-semibold">
                        {selectedPastLog.blockers}
                      </p>
                    </div>
                  )}

                  {/* Tomorrow Plan */}
                  {selectedPastLog.tomorrow_plan && (
                    <div className="space-y-1">
                      <h4 className="font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-[10px]">
                        Plan for Tomorrow
                      </h4>
                      <p className="p-3.5 bg-slate-50/30 dark:bg-zinc-900/20 border border-slate-100 dark:border-zinc-900 rounded-xl text-slate-700 dark:text-zinc-300 leading-relaxed">
                        {selectedPastLog.tomorrow_plan}
                      </p>
                    </div>
                  )}

                  {/* Tags */}
                  {selectedPastLog.tags && selectedPastLog.tags.length > 0 && (
                    <div className="space-y-1.5">
                      <h4 className="font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-[10px]">
                        Tags
                      </h4>
                      <div className="flex flex-wrap gap-1">
                        {(() => {
                          const tagsToRender = selectedPastLog.tags || [];
                          const hasCustomOther = tagsToRender.some(t => t.startsWith('Other:'));
                          const filtered = hasCustomOther 
                            ? tagsToRender.filter(t => t !== 'Other')
                            : tagsToRender;
                          return filtered.map(tag => (
                            <span key={tag} className="px-2 py-0.5 bg-brand-bg dark:bg-indigo-950/20 border border-brand-bg dark:border-indigo-900/30 text-brand-text dark:text-indigo-400 text-[10px] font-bold rounded-lg">
                              {tag}
                            </span>
                          ));
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Manager Feedback */}
                  {(selectedPastLog.status === 'acknowledged' || selectedPastLog.status === 'flagged' || selectedPastLog.manager_note) && (
                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-zinc-850 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-black text-slate-800 dark:text-zinc-200 uppercase tracking-wide text-[10px]">
                          Manager Review
                        </h4>
                        {selectedPastLog.reviewed_at && (
                          <span className="text-[9px] text-slate-400 dark:text-zinc-550 font-bold">
                            Reviewed {new Date(selectedPastLog.reviewed_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <div className="p-3.5 bg-slate-50/80 dark:bg-zinc-900/40 border border-slate-150/40 dark:border-zinc-800 rounded-xl flex items-start gap-3">
                        {selectedPastLog.reviewer?.profile_image_url ? (
                          <img src={selectedPastLog.reviewer.profile_image_url} alt="Reviewer" className="w-6 h-6 rounded-full object-cover" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-zinc-800 flex items-center justify-center font-bold text-[10px] text-slate-600 dark:text-zinc-400">
                            {selectedPastLog.reviewer?.name?.[0] || 'M'}
                          </div>
                        )}
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-700 dark:text-zinc-300">{selectedPastLog.reviewer?.name || 'Workspace Manager'}</p>
                          <p className="text-slate-655 dark:text-zinc-400 font-semibold italic text-xs leading-normal">
                            {selectedPastLog.manager_note ? `"${selectedPastLog.manager_note}"` : 'Acknowledged with no comments.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Real-time Follow-up Chat for selected past log */}
                  {selectedPastLog?.id && (
                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-zinc-850">
                      <h4 className="font-black text-slate-800 dark:text-zinc-200 uppercase tracking-wide text-[10px] mb-2">
                        Discussion Thread
                      </h4>
                      <InternLogComments logId={selectedPastLog.id} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
};

export default InternDailyLog;
