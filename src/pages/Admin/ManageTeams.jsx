import React, { useState, useEffect, useContext } from 'react';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import {
  getTeams, getTeamMembers, createTeam, updateTeam,
  deleteTeam, addTeamMember, removeTeamMember, updateTeamMemberRole,
} from '../../services/teamService';
import { WorkspaceContext } from '../../context/WorkspaceContext';
import { supabase } from '../../utils/supabaseClient';
import { JOB_PROFILES } from './InviteEmployee';
import toast from 'react-hot-toast';
import {
  LuPlus, LuPencil, LuTrash2, LuUsers, LuLoaderCircle,
  LuX, LuUserPlus, LuShield, LuUser, LuChevronDown,
  LuSave, LuCheck,
} from 'react-icons/lu';

const JP_MAP = Object.fromEntries(JOB_PROFILES.map(j => [j.value, j]));

const TEAM_COLORS = [
  '#6366f1','#8b5cf6','#ec4899','#3b82f6','#f59e0b',
  '#10b981','#f97316','#14b8a6','#ef4444','#64748b',
];
const TEAM_ICONS = ['👥','🚀','💡','🔥','⚡','🎯','🛠️','🌟','🎨','💻'];

// ─────────────────────────────────────────────────────────────────────────────
const ManageTeams = () => {
  const { workspace } = useContext(WorkspaceContext);

  const [teams,        setTeams]        = useState([]);
  const [allMembers,   setAllMembers]   = useState([]); // workspace members for picker
  const [loading,      setLoading]      = useState(false);
  const [selected,     setSelected]     = useState(null); // active team id
  const [teamMembers,  setTeamMembers]  = useState([]);
  const [teamLoading,  setTeamLoading]  = useState(false);

  // modals
  const [showCreate,  setShowCreate]  = useState(false);
  const [editTeam,    setEditTeam]    = useState(null); // team obj to edit
  const [showAddMem,  setShowAddMem]  = useState(false);
  const [delConfirm,  setDelConfirm]  = useState(null); // team id to delete

  // form state (create / edit)
  const [fName,  setFName]  = useState('');
  const [fDesc,  setFDesc]  = useState('');
  const [fColor, setFColor] = useState(TEAM_COLORS[0]);
  const [fIcon,  setFIcon]  = useState(TEAM_ICONS[0]);
  const [saving, setSaving] = useState(false);

  // ── loaders ───────────────────────────────────────────────────────────────
  const loadTeams = async () => {
    if (!workspace?.id) return;
    setLoading(true);
    try {
      const data = await getTeams(workspace.id);
      setTeams(data);
      if (data.length > 0 && !selected) setSelected(data[0].id);
    } catch (err) { toast.error('Failed to load teams'); }
    finally { setLoading(false); }
  };

  const loadWorkspaceMembers = async () => {
    if (!workspace?.id) return;
    const { data } = await supabase
      .from('workspace_members')
      .select('user_id, role, profiles(id, name, profile_image_url, job_profile, department)')
      .eq('workspace_id', workspace.id);
    setAllMembers((data || []).map(m => ({
      id:              m.profiles?.id,
      name:            m.profiles?.name,
      profileImageUrl: m.profiles?.profile_image_url,
      jobProfile:      m.profiles?.job_profile || m.role,
      department:      m.profiles?.department,
    })));
  };

  const loadTeamMembers = async (teamId) => {
    if (!teamId) return;
    setTeamLoading(true);
    try {
      const data = await getTeamMembers(teamId);
      setTeamMembers(data);
    } catch { toast.error('Failed to load team members'); }
    finally { setTeamLoading(false); }
  };

  useEffect(() => {
    loadTeams();
    loadWorkspaceMembers();
  }, [workspace?.id]);

  useEffect(() => {
    if (selected) loadTeamMembers(selected);
  }, [selected]);

  // ── form helpers ──────────────────────────────────────────────────────────
  const openCreate = () => {
    setFName(''); setFDesc(''); setFColor(TEAM_COLORS[0]); setFIcon(TEAM_ICONS[0]);
    setEditTeam(null); setShowCreate(true);
  };

  const openEdit = (team) => {
    setFName(team.name); setFDesc(team.description || '');
    setFColor(team.color); setFIcon(team.icon);
    setEditTeam(team); setShowCreate(true);
  };

  const handleSaveTeam = async (e) => {
    e.preventDefault();
    if (!fName.trim()) return toast.error('Team name is required.');
    setSaving(true);
    try {
      if (editTeam) {
        await updateTeam(editTeam.id, { name: fName, description: fDesc, color: fColor, icon: fIcon });
        toast.success('Team updated!');
      } else {
        const t = await createTeam(workspace.id, { name: fName, description: fDesc, color: fColor, icon: fIcon });
        setSelected(t.id);
        toast.success('Team created!');
      }
      setShowCreate(false);
      await loadTeams();
    } catch (err) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleDeleteTeam = async () => {
    if (!delConfirm) return;
    try {
      await deleteTeam(delConfirm);
      toast.success('Team deleted.');
      setDelConfirm(null);
      const remaining = teams.filter(t => t.id !== delConfirm);
      setSelected(remaining[0]?.id || null);
      await loadTeams();
    } catch (err) { toast.error(err.message); }
  };

  const handleRemoveMember = async (userId) => {
    try {
      await removeTeamMember(selected, userId);
      toast.success('Member removed.');
      loadTeamMembers(selected);
      loadTeams();
    } catch (err) { toast.error(err.message); }
  };

  const handleRoleToggle = async (userId, currentRole) => {
    const newRole = currentRole === 'lead' ? 'member' : 'lead';
    try {
      await updateTeamMemberRole(selected, userId, newRole);
      toast.success(`Role changed to ${newRole}.`);
      loadTeamMembers(selected);
    } catch (err) { toast.error(err.message); }
  };

  const activeTeam = teams.find(t => t.id === selected);
  const memberIds  = teamMembers.map(m => m.userId);
  const nonMembers = allMembers.filter(m => !memberIds.includes(m.id));

  return (
    <DashboardLayout activeMenu="Teams">
      <div className="mt-5 mb-10 animate-fade-in font-sans">

        {/* Page header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-905 dark:text-zinc-105 tracking-tight">
              👥 Team Management
            </h1>
            <p className="text-xs text-slate-400 dark:text-zinc-550 mt-1.5 font-bold uppercase tracking-wider">
              {workspace?.name} · <span className="font-bold text-indigo-650 dark:text-indigo-400">{teams.length} team{teams.length !== 1 ? 's' : ''}</span>
            </p>
          </div>
          <button onClick={openCreate} className="card-btn-fill flex items-center gap-1.5 text-xs font-bold transition cursor-pointer">
            <LuPlus size={14}/> New Team
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
            <LuLoaderCircle className="animate-spin text-indigo-505 text-3xl" />
            <p className="text-xs text-slate-400 dark:text-zinc-550 font-bold uppercase tracking-wider">Loading team hierarchy...</p>
          </div>
        ) : teams.length === 0 ? (
          <EmptyState onCreateClick={openCreate}/>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">

            {/* ── Left: Team list ── */}
            <div className="w-full lg:w-72 flex-shrink-0 flex flex-col gap-3">
              {teams.map(team => (
                <TeamCard
                  key={team.id}
                  team={team}
                  active={selected === team.id}
                  onClick={() => setSelected(team.id)}
                  onEdit={() => openEdit(team)}
                  onDelete={() => setDelConfirm(team.id)}
                />
              ))}
            </div>

            {/* ── Right: Team detail ── */}
            <div className="flex-1 min-w-0">
              {activeTeam && (
                <div className="card overflow-hidden !p-0">

                  {/* Team header */}
                  <div className="flex items-center justify-between p-5 border-b border-slate-105 dark:border-zinc-800/80"
                    style={{ background: activeTeam.color + '0d' }}>
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{activeTeam.icon}</span>
                      <div>
                        <h3 className="font-extrabold text-slate-805 dark:text-zinc-150 text-base leading-tight">{activeTeam.name}</h3>
                        {activeTeam.description && (
                          <p className="text-slate-500 dark:text-zinc-400 text-xs mt-1 font-semibold">{activeTeam.description}</p>
                        )}
                        <p className="text-[10px] text-slate-400 dark:text-zinc-550 mt-1 uppercase font-bold tracking-wider">
                          {activeTeam.memberCount} member{activeTeam.memberCount !== 1 ? 's' : ''} ·
                          Created by {activeTeam.createdByName}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowAddMem(true)}
                      className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-lg border transition-all cursor-pointer hover:shadow-sm"
                      style={{ borderColor: activeTeam.color + '60', color: activeTeam.color, background: activeTeam.color + '12' }}
                    >
                      <LuUserPlus size={13}/> Add Member
                    </button>
                  </div>

                  {/* Members table */}
                  {teamLoading ? (
                    <div className="flex justify-center py-12">
                      <LuLoaderCircle className="animate-spin text-indigo-505" size={24}/>
                    </div>
                  ) : teamMembers.length === 0 ? (
                    <div className="text-center py-16 text-slate-400 dark:text-zinc-500">
                      <LuUsers size={36} className="mx-auto mb-3 opacity-30"/>
                      <p className="text-xs font-bold uppercase tracking-wider">No members yet.</p>
                      <button onClick={() => setShowAddMem(true)}
                        className="mt-3 text-xs text-indigo-550 dark:text-indigo-400 font-bold hover:underline">
                        Add the first member →
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="premium-table min-w-full">
                        <thead>
                          <tr className="border-b border-slate-100 dark:border-zinc-800/80 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                            <th className="px-5 py-3 text-left">Member</th>
                            <th className="px-5 py-3 text-left">Job Profile</th>
                            <th className="px-5 py-3 text-left">Department</th>
                            <th className="px-5 py-3 text-left">Team Role</th>
                            <th className="px-5 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-105 dark:divide-zinc-800/80">
                          {teamMembers.map(m => {
                            const jp = JP_MAP[m.jobProfile] || JP_MAP.employee;
                            return (
                              <tr key={m.userId} className="hover:bg-slate-25/50 dark:hover:bg-zinc-900/10 transition">
                                <td className="px-5 py-3.5">
                                  <div className="flex items-center gap-2.5">
                                    {m.profileImageUrl ? (
                                      <img src={m.profileImageUrl} alt={m.name}
                                        className="w-7 h-7 rounded-lg object-cover border border-slate-100 dark:border-zinc-800"/>
                                    ) : (
                                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                                        style={{ background: (jp?.color || '#6366f1') + '20', color: jp?.color || '#6366f1' }}>
                                        {jp?.emoji || '👤'}
                                      </div>
                                    )}
                                    <span className="font-bold text-slate-805 dark:text-zinc-200 text-xs">{m.name}</span>
                                  </div>
                                </td>
                                <td className="px-5 py-3.5">
                                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded uppercase border"
                                    style={{ background: (jp?.color || '#64748b') + '12', color: jp?.color || '#64748b', borderColor: (jp?.color || '#64748b') + '25' }}>
                                    {jp?.emoji} {jp?.label || m.jobProfile}
                                  </span>
                                </td>
                                <td className="px-5 py-3.5 text-xs text-slate-500 dark:text-zinc-450 font-semibold">
                                  {m.department || <span className="text-slate-300 dark:text-zinc-700">—</span>}
                                </td>
                                <td className="px-5 py-3.5">
                                  <button
                                    onClick={() => handleRoleToggle(m.userId, m.teamRole)}
                                    className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded border cursor-pointer transition-all hover:shadow-sm ${
                                      m.teamRole === 'lead'
                                        ? 'bg-amber-50 dark:bg-amber-955/15 text-amber-600 dark:text-amber-400 border-amber-200/50 dark:border-amber-900/30'
                                        : 'bg-slate-50 dark:bg-zinc-900/40 text-slate-500 dark:text-zinc-450 border-slate-200 dark:border-zinc-800'
                                    }`}
                                    title="Click to toggle role"
                                  >
                                    {m.teamRole === 'lead' ? <LuShield size={10}/> : <LuUser size={10}/>}
                                    {m.teamRole === 'lead' ? 'Team Lead' : 'Member'}
                                  </button>
                                </td>
                                <td className="px-5 py-3.5 text-right">
                                  <button
                                    onClick={() => handleRemoveMember(m.userId)}
                                    className="text-slate-400 hover:text-rose-600 hover:bg-rose-50/50 dark:hover:bg-zinc-800 p-1.5 rounded-lg transition cursor-pointer"
                                    title="Remove from team"
                                  >
                                    <LuX size={14}/>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Create / Edit Modal ── */}
      {showCreate && (
        <Modal title={editTeam ? 'Edit Team' : 'Create Team'} onClose={() => setShowCreate(false)}>
          <form onSubmit={handleSaveTeam} className="flex flex-col gap-4">
            <div>
              <label className="field-label text-slate-500 dark:text-zinc-400">Team Name *</label>
              <input value={fName} onChange={e => setFName(e.target.value)}
                placeholder="e.g. Frontend Team" className="field-input dark:bg-[#121215] dark:border-zinc-805 dark:text-zinc-200" required/>
            </div>
            <div>
              <label className="field-label text-slate-500 dark:text-zinc-400">Description</label>
              <textarea value={fDesc} onChange={e => setFDesc(e.target.value)}
                placeholder="What does this team work on?" rows={2} className="field-input dark:bg-[#121215] dark:border-zinc-805 dark:text-zinc-200 resize-none"/>
            </div>

            {/* Icon picker */}
            <div>
              <label className="field-label text-slate-500 dark:text-zinc-400">Icon</label>
              <div className="flex flex-wrap gap-2">
                {TEAM_ICONS.map(ic => (
                  <button key={ic} type="button" onClick={() => setFIcon(ic)}
                    className={`w-9 h-9 rounded-lg text-xl flex items-center justify-center border-2 transition cursor-pointer ${
                      fIcon === ic ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/20 dark:border-indigo-800' : 'border-slate-200 dark:border-zinc-800 hover:border-slate-350 dark:hover:border-zinc-700'}`}>
                    {ic}
                  </button>
                ))}
              </div>
            </div>

            {/* Color picker */}
            <div>
              <label className="field-label text-slate-500 dark:text-zinc-400">Colour</label>
              <div className="flex flex-wrap gap-2">
                {TEAM_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setFColor(c)}
                    className="w-7 h-7 rounded-full border-2 transition-all cursor-pointer flex items-center justify-center"
                    style={{ background: c, borderColor: fColor === c ? 'currentColor' : 'transparent' }}>
                    {fColor === c && <LuCheck size={12} className="text-white"/>}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="rounded-xl p-3 flex items-center gap-3 border"
              style={{ background: fColor + '12', borderColor: fColor + '30' }}>
              <span className="text-2xl">{fIcon}</span>
              <div>
                <p className="font-bold text-sm text-slate-800 dark:text-zinc-200">{fName || 'Team Name'}</p>
                <p className="text-xs text-slate-500 dark:text-zinc-450 font-semibold">{fDesc || 'Team description'}</p>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setShowCreate(false)} className="card-btn flex-shrink-0 px-5 cursor-pointer">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="card-btn-fill flex-1 flex items-center justify-center gap-2 cursor-pointer">
                {saving ? <LuLoaderCircle size={15} className="animate-spin"/> : <LuSave size={15}/>}
                {saving ? 'Saving…' : (editTeam ? 'Save Changes' : 'Create Team')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Add Member Modal ── */}
      {showAddMem && activeTeam && (
        <AddMemberModal
          team={activeTeam}
          candidates={nonMembers}
          onClose={() => setShowAddMem(false)}
          onAdd={async (userId, role) => {
            try {
              await addTeamMember(selected, userId, role);
              toast.success('Member added!');
              loadTeamMembers(selected);
              loadTeams();
            } catch (err) { toast.error(err.message); }
          }}
        />
      )}

      {/* ── Delete Confirm ── */}
      {delConfirm && (
        <Modal title="Delete Team" onClose={() => setDelConfirm(null)}>
          <p className="text-slate-600 dark:text-zinc-350 text-sm mb-6">
            Are you sure you want to delete <strong>{teams.find(t => t.id === delConfirm)?.name}</strong>?
            All team memberships will be removed. Tasks assigned to this team will remain.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setDelConfirm(null)} className="card-btn flex-1 cursor-pointer">Cancel</button>
            <button onClick={handleDeleteTeam}
              className="flex-1 bg-red-650 hover:bg-red-755 text-white font-bold py-2 rounded-xl transition text-xs uppercase tracking-wider cursor-pointer">
              Delete Team
            </button>
          </div>
        </Modal>
      )}
    </DashboardLayout>
  );
};

// ── Sub-components ────────────────────────────────────────────────────────────

const TeamCard = ({ team, active, onClick, onEdit, onDelete }) => (
  <div
    onClick={onClick}
    className={`rounded-xl border p-4 cursor-pointer transition-all select-none ${
      active ? 'shadow-md border-indigo-500/50' : 'border-slate-205 dark:border-zinc-800 bg-white dark:bg-[#151518]/30 hover:border-slate-300 dark:hover:border-zinc-700 hover:shadow-sm'
    }`}
    style={active ? { borderColor: team.color, background: team.color + '0a' } : {}}
  >
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-xl flex-shrink-0">{team.icon}</span>
        <div className="min-w-0">
          <p className="font-bold text-slate-805 dark:text-zinc-200 text-sm truncate">{team.name}</p>
          <p className="text-xs text-slate-400 dark:text-zinc-550 font-semibold">{team.memberCount} member{team.memberCount !== 1 ? 's' : ''}</p>
        </div>
      </div>
      {active && (
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={e => { e.stopPropagation(); onEdit(); }}
            className="p-1 rounded text-slate-450 hover:text-indigo-650 hover:bg-indigo-50/50 dark:hover:bg-zinc-800 transition cursor-pointer">
            <LuPencil size={12}/>
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete(); }}
            className="p-1 rounded text-slate-455 hover:text-rose-650 hover:bg-rose-50/50 dark:hover:bg-zinc-800 transition cursor-pointer">
            <LuTrash2 size={12}/>
          </button>
        </div>
      )}
    </div>
    {active && (
      <div className="mt-2 h-0.5 rounded-full" style={{ background: team.color }}/>
    )}
  </div>
);

const Modal = ({ title, onClose, children }) => (
  <>
    <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose}/>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-[#121215] border border-slate-200/60 dark:border-zinc-800 rounded-2xl shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-zinc-800/80">
          <h3 className="font-extrabold text-slate-805 dark:text-zinc-200 text-sm uppercase tracking-wider">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition cursor-pointer">
            <LuX size={18}/>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  </>
);

const AddMemberModal = ({ team, candidates, onClose, onAdd }) => {
  const [selectedUser, setSelectedUser] = useState('');
  const [role, setRole] = useState('member');
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!selectedUser) return toast.error('Select a member first.');
    setAdding(true);
    await onAdd(selectedUser, role);
    setAdding(false);
    setSelectedUser('');
  };

  return (
    <Modal title={`Add to ${team.name}`} onClose={onClose}>
      {candidates.length === 0 ? (
        <p className="text-slate-500 dark:text-zinc-500 text-sm text-center py-4 font-semibold">
          All workspace members are already in this team.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <label className="field-label text-slate-500 dark:text-zinc-400">Select Member</label>
            <div className="relative">
              <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)}
                className="field-input appearance-none pr-7 dark:bg-[#121215] dark:border-zinc-800 dark:text-zinc-200 cursor-pointer">
                <option value="">Choose a member…</option>
                {candidates.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.department ? `(${m.department})` : ''}
                  </option>
                ))}
              </select>
              <LuChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-450 pointer-events-none"/>
            </div>
          </div>
          <div>
            <label className="field-label text-slate-500 dark:text-zinc-400">Team Role</label>
            <div className="flex gap-2">
              {['member', 'lead'].map(r => (
                <button key={r} type="button" onClick={() => setRole(r)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-sm font-semibold transition cursor-pointer ${
                    role === r ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400' : 'border-slate-200 dark:border-zinc-800 text-slate-500 hover:border-slate-300 dark:hover:border-zinc-700'}`}>
                  {r === 'lead' ? <LuShield size={14}/> : <LuUser size={14}/>}
                  {r === 'lead' ? 'Team Lead' : 'Member'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="card-btn flex-1 cursor-pointer">Cancel</button>
            <button onClick={handleAdd} disabled={adding}
              className="card-btn-fill flex-1 flex items-center justify-center gap-2 cursor-pointer">
              {adding ? <LuLoaderCircle size={14} className="animate-spin"/> : <LuUserPlus size={14}/>}
              {adding ? 'Adding…' : 'Add to Team'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};

const EmptyState = ({ onCreateClick }) => (
  <div className="text-center py-20">
    <div className="text-5xl mb-4">👥</div>
    <h3 className="text-lg font-bold text-slate-805 dark:text-zinc-200 mb-2">No teams yet</h3>
    <p className="text-slate-400 dark:text-zinc-500 text-sm mb-6 max-w-xs mx-auto font-medium">
      Organise your workspace by creating functional teams — Engineering, Design, Marketing, and more.
    </p>
    <button onClick={onCreateClick} className="card-btn-fill inline-flex items-center gap-2 cursor-pointer">
      <LuPlus size={16}/> Create First Team
    </button>
  </div>
);

export default ManageTeams;
