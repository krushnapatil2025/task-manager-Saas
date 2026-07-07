import React, { useContext, useState, useEffect, useCallback } from 'react';
import {
  LuUser, LuMail, LuShield, LuCalendar, LuFolder,
  LuCircleCheck, LuCircleAlert, LuLoaderCircle, LuBriefcase,
  LuUsers, LuPencil, LuSave, LuX, LuInfo, LuHeart, LuBell
} from 'react-icons/lu';
import { UserContext } from '../../context/userContext';
import { WorkspaceContext } from '../../context/WorkspaceContext';
import { getMyTasks } from '../../services/taskService';
import { getTeams } from '../../services/teamService';
import { supabase } from '../../utils/supabaseClient';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import toast from 'react-hot-toast';
import moment from 'moment';
import { NOTIFICATION_SOUNDS, playNotificationSound } from '../../utils/audioSynthesizer';

const AVATAR_TEMPLATES = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=150&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80',
  'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=150&q=80'
];

const STATUS_OPTIONS = [
  { id: 'active',    label: 'Active',     color: '#10b981', dot: 'bg-emerald-500', desc: 'You appear online' },
  { id: 'away',      label: 'Away',       color: '#f59e0b', dot: 'bg-amber-400',   desc: 'You appear away' },
  { id: 'busy',      label: 'Do not disturb', color: '#ef4444', dot: 'bg-red-500', desc: 'Notifications silenced' },
  { id: 'inactive',  label: 'Invisible',  color: '#94a3b8', dot: 'bg-slate-400',   desc: 'Appear offline to others' }
];

const UserProfile = () => {
  const { user, updateUser } = useContext(UserContext);
  const { workspace } = useContext(WorkspaceContext);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [userTeams, setUserTeams] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ name: '', department: '', profile_image_url: '' });

  // Status & sounds
  const [currentStatus, setCurrentStatus] = useState(() => localStorage.getItem('user_status') || 'active');
  const [notifSound, setNotifSound] = useState(() => localStorage.getItem('setting_notif_sound') || 'chime');
  const [savingStatus, setSavingStatus] = useState(false);

  const loadRelatedData = useCallback(async () => {
    if (!user?.id || !workspace?.id) return;
    try {
      setLoading(true);
      const fetchedTasks = await getMyTasks(user.id, workspace.id);
      setTasks(fetchedTasks);
      const allTeams = await getTeams(workspace.id);
      setUserTeams(allTeams.filter(t => t.memberIds.includes(user.id)));
    } catch (err) {
      toast.error('Failed to load profile insights');
    } finally {
      setLoading(false);
    }
  }, [user?.id, workspace?.id]);

  useEffect(() => {
    if (user) {
      setFormData({ name: user.name || '', department: user.department || '', profile_image_url: user.profile_image_url || '' });
      loadRelatedData();
    }
  }, [user, loadRelatedData]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast.error('Name cannot be empty'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({
        name: formData.name.trim(),
        department: formData.department.trim(),
        profile_image_url: formData.profile_image_url.trim()
      }).eq('id', user.id);
      if (error) throw error;
      await updateUser();
      setIsEditing(false);
      toast.success('Profile updated!');
    } catch (err) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (statusId) => {
    setSavingStatus(true);
    try {
      const { error } = await supabase.from('profiles').update({ status: statusId }).eq('id', user.id);
      if (error) throw error;
      setCurrentStatus(statusId);
      localStorage.setItem('user_status', statusId);
      toast.success(`Status set to ${STATUS_OPTIONS.find(s => s.id === statusId)?.label}`);
    } catch {
      // Fallback to localStorage only if column not yet migrated
      setCurrentStatus(statusId);
      localStorage.setItem('user_status', statusId);
    } finally {
      setSavingStatus(false);
    }
  };

  const handleNotifSoundChange = (id) => {
    setNotifSound(id);
    localStorage.setItem('setting_notif_sound', id);
    playNotificationSound(id);
  };

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'Completed').length;
  const inProgressTasks = tasks.filter(t => t.status === 'In Progress').length;
  const pendingTasks = tasks.filter(t => t.status === 'Pending').length;
  const overdueTasks = tasks.filter(t => t.dueDate && moment(t.dueDate).isBefore(moment(), 'day') && t.status !== 'Completed').length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const activeStatusObj = STATUS_OPTIONS.find(s => s.id === currentStatus) || STATUS_OPTIONS[0];

  return (
    <DashboardLayout activeMenu="User Profile">
      <div className="max-w-5xl mx-auto animate-fade-in space-y-6 font-sans mt-4 pb-12">

        {/* ── Banner header ─────────────────────────────────────────────── */}
        <div className="relative rounded-3xl overflow-hidden border border-slate-205 dark:border-zinc-800/80 bg-white dark:bg-[#151518]/30 shadow-md">
          <div className="h-32 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-80" />

          <div className="px-6 pb-6 pt-0 relative flex flex-col md:flex-row md:items-end md:justify-between gap-5 -mt-12">
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4">
              {/* Avatar with status ring */}
              <div className="relative group">
                {formData.profile_image_url ? (
                  <img src={formData.profile_image_url} alt={formData.name}
                    className="w-24 h-24 rounded-2xl object-cover border-4 border-white dark:border-[#121215] shadow-xl" />
                ) : (
                  <div className="w-24 h-24 rounded-2xl bg-indigo-500 text-white font-bold text-3xl flex items-center justify-center border-4 border-white dark:border-[#121215] shadow-xl">
                    {formData.name?.[0]?.toUpperCase() || 'U'}
                  </div>
                )}
                {/* Status dot */}
                <span className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white dark:border-[#121215] ${activeStatusObj.dot} shadow-md`} title={activeStatusObj.label} />
                {isEditing && (
                  <div className="absolute inset-0 bg-black/45 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer">
                    <LuPencil className="text-white text-lg" />
                  </div>
                )}
              </div>

              <div className="text-center sm:text-left pb-1">
                <h2 className="text-xl md:text-2xl font-extrabold text-slate-805 dark:text-zinc-150">{user?.name}</h2>
                <p className="text-xs text-slate-450 dark:text-zinc-500 font-bold uppercase tracking-wider flex items-center gap-1.5 justify-center sm:justify-start mt-1">
                  <LuBriefcase size={12} />
                  {user?.job_profile?.replace('_', ' ') || 'Team Member'}
                  {user?.department && <><span>•</span><span>🏢 {user.department}</span></>}
                </p>
                {/* Status badge */}
                <span className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold border"
                  style={{ background: activeStatusObj.color + '15', color: activeStatusObj.color, borderColor: activeStatusObj.color + '30' }}>
                  <span className={`w-1.5 h-1.5 rounded-full ${activeStatusObj.dot}`} />
                  {activeStatusObj.label}
                </span>
              </div>
            </div>

            <div className="flex justify-center md:justify-end">
              {isEditing ? (
                <div className="flex gap-2">
                  <button onClick={() => { setFormData({ name: user.name || '', department: user.department || '', profile_image_url: user.profile_image_url || '' }); setIsEditing(false); }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 transition cursor-pointer text-slate-700 dark:text-zinc-300">
                    <LuX size={14} /> Cancel
                  </button>
                  <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:opacity-95 text-white rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-65 shadow-md">
                    {saving ? <LuLoaderCircle size={14} className="animate-spin" /> : <LuSave size={14} />}
                    Save Changes
                  </button>
                </div>
              ) : (
                <button onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1.5 px-5 py-2.5 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-650 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 border border-indigo-100/50 dark:border-indigo-900/30 rounded-xl text-xs font-extrabold transition cursor-pointer">
                  <LuPencil size={14} /> Edit Profile
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Edit form ──────────────────────────────────────────────────── */}
        {isEditing && (
          <form onSubmit={handleSave} className="card animate-fade-in">
            <h3 className="font-extrabold text-sm text-slate-805 dark:text-zinc-200 mb-4 flex items-center gap-1.5">
              <LuPencil size={16} className="text-indigo-505" /> Edit Personal Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">Full Name</label>
                <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="field-input dark:bg-[#121215] dark:border-zinc-800 dark:text-zinc-200" placeholder="Enter full name" maxLength={50} required />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1">Department</label>
                <input type="text" value={formData.department} onChange={e => setFormData({ ...formData, department: e.target.value })}
                  className="field-input dark:bg-[#121215] dark:border-zinc-800 dark:text-zinc-200" placeholder="e.g. Engineering, Marketing" maxLength={50} />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block">Profile Image URL</label>
                <input type="url" value={formData.profile_image_url} onChange={e => setFormData({ ...formData, profile_image_url: e.target.value })}
                  className="field-input dark:bg-[#121215] dark:border-zinc-800 dark:text-zinc-200" placeholder="Paste profile image link" />
                <div className="pt-2">
                  <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2">Or select from templates:</p>
                  <div className="flex flex-wrap gap-3">
                    {AVATAR_TEMPLATES.map((url, i) => (
                      <button type="button" key={i} onClick={() => setFormData({ ...formData, profile_image_url: url })}
                        className={`w-12 h-12 rounded-xl overflow-hidden border-2 transition transform hover:scale-105 cursor-pointer ${formData.profile_image_url === url ? 'border-indigo-500 scale-105 shadow-md' : 'border-transparent'}`}>
                        <img src={url} alt="template" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </form>
        )}

        {/* ── Status selector ────────────────────────────────────────────── */}
        <div className="card shadow-sm mb-0">
          <h3 className="font-extrabold text-sm text-slate-805 dark:text-zinc-200 mb-4 flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded-full ${activeStatusObj.dot}`} /> Presence Status
            {savingStatus && <LuLoaderCircle size={13} className="animate-spin text-indigo-505 ml-auto" />}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {STATUS_OPTIONS.map(s => (
              <button key={s.id} onClick={() => handleStatusChange(s.id)}
                className={`flex flex-col items-center gap-2 p-3.5 rounded-2xl border-2 text-center transition-all cursor-pointer ${currentStatus === s.id ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 shadow-sm' : 'border-slate-100 dark:border-zinc-800/80 hover:border-slate-300 dark:hover:border-zinc-700 bg-slate-50/50 dark:bg-zinc-900/10'}`}>
                <span className={`w-4 h-4 rounded-full ${s.dot} shadow-sm`} />
                <span className={`text-xs font-bold ${currentStatus === s.id ? 'text-indigo-700 dark:text-indigo-400' : 'text-slate-600 dark:text-zinc-400'}`}>{s.label}</span>
                <span className="text-[10px] text-slate-400 dark:text-zinc-500 leading-tight font-medium">{s.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Stats grid ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Total Tasks', value: totalTasks, sub: 'assigned', color: 'text-slate-805 dark:text-zinc-200' },
            { label: 'Completion', value: `${completionRate}%`, sub: 'done', color: 'text-emerald-500' },
            { label: 'Pending', value: pendingTasks, sub: 'todo', color: 'text-indigo-500' },
            { label: 'In Progress', value: inProgressTasks, sub: 'active', color: 'text-amber-500' },
            { label: 'Overdue', value: overdueTasks, sub: 'late', color: overdueTasks > 0 ? 'text-red-500' : 'text-slate-400 dark:text-zinc-550' },
          ].map(stat => (
            <div key={stat.label} className="card p-4 flex flex-col justify-between mb-0 shadow-sm border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">{stat.label}</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span className={`text-2xl font-extrabold ${stat.color}`}>{stat.value}</span>
                <span className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">{stat.sub}</span>
              </div>
            </div>
          ))}
        </div>

        {/* ── Sound Preferences ─────────────────────────────────────────── */}
        <div className="card shadow-sm mb-0">
          <h3 className="font-extrabold text-sm text-slate-850 dark:text-zinc-200 mb-4 flex items-center gap-1.5">
            <LuBell size={15} className="text-indigo-505" /> Notification Sound Preferences
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {NOTIFICATION_SOUNDS.map(s => (
              <button key={s.id} onClick={() => handleNotifSoundChange(s.id)}
                className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border-2 text-center transition-all cursor-pointer ${notifSound === s.id ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 shadow-sm text-indigo-700 dark:text-indigo-400' : 'border-slate-100 dark:border-zinc-800/80 hover:border-slate-300 dark:hover:border-zinc-700 bg-slate-50/50 dark:bg-zinc-900/10 text-slate-600 dark:text-zinc-400'}`}>
                <span className="text-xs font-bold">{s.name}</span>
                {notifSound === s.id && <LuCircleCheck size={14} className="text-indigo-500 mt-1.5" />}
              </button>
            ))}
          </div>
        </div>

        {/* ── Credentials + Teams grid ───────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div className="card shadow-sm mb-0">
              <h3 className="font-extrabold text-sm text-slate-805 dark:text-zinc-200 mb-4 flex items-center gap-1.5">
                <LuInfo size={16} className="text-indigo-505" /> Account Credentials
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { icon: <LuMail size={16} />, label: 'Email', value: user?.email },
                  { icon: <LuShield size={16} />, label: 'System Role', value: user?.role || 'Member' },
                  { icon: <LuFolder size={16} />, label: 'Workspace', value: workspace?.name || '...' },
                  { icon: <LuCalendar size={16} />, label: 'Member Since', value: user?.created_at ? moment(user.created_at).format('LL') : '—' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-3 bg-slate-50/40 dark:bg-[#121215]/30 border border-slate-100 dark:border-zinc-800/80 p-3.5 rounded-2xl">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/20 text-indigo-500 dark:text-indigo-400 flex items-center justify-center shrink-0">{item.icon}</div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">{item.label}</p>
                      <p className="text-xs font-semibold text-slate-700 dark:text-zinc-200 truncate">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Progress bar */}
            <div className="card shadow-sm">
              <h3 className="font-extrabold text-sm text-slate-805 dark:text-zinc-200 mb-4">Assigned Tasks Completion</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 dark:text-zinc-450 font-bold uppercase tracking-wider">Overall progress</span>
                  <span className="font-extrabold text-indigo-650 dark:text-indigo-400">{completionRate}% Done</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-zinc-800 rounded-full h-3.5 overflow-hidden">
                  <div className="bg-gradient-to-r from-indigo-500 to-violet-600 h-full rounded-full transition-all duration-500" style={{ width: `${completionRate}%` }} />
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold uppercase tracking-wider pt-1 text-slate-400 dark:text-zinc-550">
                  {[['Pending', pendingTasks, 'text-indigo-500'], ['Active', inProgressTasks, 'text-amber-500'], ['Completed', completedTasks, 'text-emerald-500']].map(([l, v, c]) => (
                    <div key={l} className="bg-slate-50 dark:bg-[#121215]/40 p-2 rounded-xl border border-transparent dark:border-zinc-800/80">
                      <p className={`${c} text-sm font-extrabold`}>{v}</p>
                      <p className="mt-0.5">{l}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Teams list */}
          <div className="card shadow-sm h-full">
            <h3 className="font-extrabold text-sm text-slate-805 dark:text-zinc-200 mb-4 flex items-center gap-1.5">
              <LuUsers size={16} className="text-indigo-505" /> Associated Teams
            </h3>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <LuLoaderCircle size={20} className="animate-spin text-indigo-500" />
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Syncing…</p>
              </div>
            ) : userTeams.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl">
                <LuUsers size={32} className="mx-auto mb-2 text-slate-300 dark:text-zinc-700" />
                <p className="text-xs text-slate-450 dark:text-zinc-500 font-bold uppercase tracking-wider">No teams joined</p>
              </div>
            ) : (
              <div className="space-y-3">
                {userTeams.map(t => (
                  <div key={t.id} className="flex items-center gap-3 p-3 bg-slate-50/40 dark:bg-[#121215]/30 border border-slate-100 dark:border-zinc-800/80 rounded-2xl hover:border-slate-200 dark:hover:border-zinc-750 transition">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ background: t.color + '15', color: t.color }}>{t.icon || '👥'}</div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-xs text-slate-800 dark:text-zinc-200 truncate">{t.name}</h4>
                      <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">{t.memberCount} members</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="text-center pt-4 pb-2">
          <p className="text-[10px] text-slate-400 dark:text-zinc-550 font-bold uppercase tracking-wider flex items-center justify-center gap-1">
            Made with <LuHeart size={10} className="text-red-400 fill-red-400 animate-pulse" /> by Strideo Team
          </p>
        </div>

      </div>
    </DashboardLayout>
  );
};

export default UserProfile;
