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

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout activeMenu="Teams">
      <div className="mt-5 mb-10">

        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Team Management</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {workspace?.name} · <span className="font-medium text-gray-600">{teams.length} team{teams.length !== 1 ? 's' : ''}</span>
            </p>
          </div>
          <button onClick={openCreate} className="btn-primary flex items-center gap-2 text-sm">
            <LuPlus size={16}/> New Team
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <LuLoaderCircle className="animate-spin text-blue-500" size={28}/>
          </div>
        ) : teams.length === 0 ? (
          <EmptyState onCreateClick={openCreate}/>
        ) : (
          <div className="flex gap-5">

            {/* ── Left: Team list ── */}
            <div className="w-64 flex-shrink-0 flex flex-col gap-2">
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
                <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">

                  {/* Team header */}
                  <div className="flex items-center justify-between p-5 border-b border-gray-100"
                    style={{ background: activeTeam.color + '0d' }}>
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{activeTeam.icon}</span>
                      <div>
                        <h3 className="font-bold text-gray-800 text-lg leading-tight">{activeTeam.name}</h3>
                        {activeTeam.description && (
                          <p className="text-gray-500 text-sm mt-0.5">{activeTeam.description}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {activeTeam.memberCount} member{activeTeam.memberCount !== 1 ? 's' : ''} ·
                          Created by {activeTeam.createdByName}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowAddMem(true)}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-all hover:shadow-sm"
                      style={{ borderColor: activeTeam.color + '60', color: activeTeam.color, background: activeTeam.color + '12' }}
                    >
                      <LuUserPlus size={13}/> Add Member
                    </button>
                  </div>

                  {/* Members table */}
                  {teamLoading ? (
                    <div className="flex justify-center py-10">
                      <LuLoaderCircle className="animate-spin text-blue-400" size={22}/>
                    </div>
                  ) : teamMembers.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                      <LuUsers size={32} className="mx-auto mb-2 opacity-30"/>
                      <p className="text-sm">No members yet.</p>
                      <button onClick={() => setShowAddMem(true)}
                        className="mt-3 text-xs text-blue-500 hover:underline">
                        Add the first member →
                      </button>
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                          <th className="text-left px-5 py-3">Member</th>
                          <th className="text-left px-5 py-3">Job Profile</th>
                          <th className="text-left px-5 py-3">Department</th>
                          <th className="text-left px-5 py-3">Team Role</th>
                          <th className="text-right px-5 py-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {teamMembers.map(m => {
                          const jp = JP_MAP[m.jobProfile] || JP_MAP.employee;
                          return (
                            <tr key={m.userId} className="hover:bg-gray-50 transition-colors">
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-2.5">
                                  {m.profileImageUrl ? (
                                    <img src={m.profileImageUrl} alt={m.name}
                                      className="w-8 h-8 rounded-lg object-cover"/>
                                  ) : (
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                                      style={{ background: (jp?.color || '#6366f1') + '20' }}>
                                      {jp?.emoji || '👤'}
                                    </div>
                                  )}
                                  <span className="font-medium text-gray-800">{m.name}</span>
                                </div>
                              </td>
                              <td className="px-5 py-3">
                                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                                  style={{ background: (jp?.color || '#64748b') + '18', color: jp?.color || '#64748b' }}>
                                  {jp?.emoji} {jp?.label || m.jobProfile}
                                </span>
                              </td>
                              <td className="px-5 py-3 text-xs text-gray-500">
                                {m.department || <span className="text-gray-300">—</span>}
                              </td>
                              <td className="px-5 py-3">
                                <button
                                  onClick={() => handleRoleToggle(m.userId, m.teamRole)}
                                  className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border cursor-pointer transition-all hover:shadow-sm ${
                                    m.teamRole === 'lead'
                                      ? 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100'
                                      : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                                  }`}
                                  title="Click to toggle role"
                                >
                                  {m.teamRole === 'lead' ? <LuShield size={10}/> : <LuUser size={10}/>}
                                  {m.teamRole === 'lead' ? 'Team Lead' : 'Member'}
                                </button>
                              </td>
                              <td className="px-5 py-3 text-right">
                                <button
                                  onClick={() => handleRemoveMember(m.userId)}
                                  className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition"
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
              <label className="field-label">Team Name *</label>
              <input value={fName} onChange={e => setFName(e.target.value)}
                placeholder="e.g. Frontend Team" className="field-input" required/>
            </div>
            <div>
              <label className="field-label">Description</label>
              <textarea value={fDesc} onChange={e => setFDesc(e.target.value)}
                placeholder="What does this team work on?" rows={2} className="field-input resize-none"/>
            </div>

            {/* Icon picker */}
            <div>
              <label className="field-label">Icon</label>
              <div className="flex flex-wrap gap-2">
                {TEAM_ICONS.map(ic => (
                  <button key={ic} type="button" onClick={() => setFIcon(ic)}
                    className={`w-9 h-9 rounded-lg text-xl flex items-center justify-center border-2 transition ${
                      fIcon === ic ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    {ic}
                  </button>
                ))}
              </div>
            </div>

            {/* Color picker */}
            <div>
              <label className="field-label">Colour</label>
              <div className="flex flex-wrap gap-2">
                {TEAM_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setFColor(c)}
                    className="w-7 h-7 rounded-full border-2 transition-all"
                    style={{ background: c, borderColor: fColor === c ? '#1e1b4b' : 'transparent' }}>
                    {fColor === c && <LuCheck size={12} className="text-white mx-auto"/>}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="rounded-xl p-3 flex items-center gap-3"
              style={{ background: fColor + '15', border: `1px solid ${fColor}40` }}>
              <span className="text-2xl">{fIcon}</span>
              <div>
                <p className="font-bold text-sm text-gray-800">{fName || 'Team Name'}</p>
                <p className="text-xs text-gray-500">{fDesc || 'Team description'}</p>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setShowCreate(false)} className="btn-ghost flex-shrink-0 px-5">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
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
          <p className="text-gray-600 text-sm mb-6">
            Are you sure you want to delete <strong>{teams.find(t => t.id === delConfirm)?.name}</strong>?
            All team memberships will be removed. Tasks assigned to this team will remain.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setDelConfirm(null)} className="btn-ghost flex-1">Cancel</button>
            <button onClick={handleDeleteTeam}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded-xl transition text-sm">
              Delete Team
            </button>
          </div>
        </Modal>
      )}

      <style>{`
        .btn-primary{background:linear-gradient(to right,#2563eb,#7c3aed);color:white;font-weight:600;padding:.5rem 1.1rem;border-radius:.75rem;border:none;cursor:pointer;transition:opacity .2s;}
        .btn-primary:hover{opacity:.9;} .btn-primary:disabled{opacity:.55;cursor:not-allowed;}
        .btn-ghost{background:#f9fafb;color:#374151;font-weight:600;padding:.5rem 1rem;border-radius:.75rem;border:1px solid #e5e7eb;cursor:pointer;transition:background .15s;}
        .btn-ghost:hover{background:#f3f4f6;}
        .field-label{display:block;font-size:.75rem;font-weight:500;color:#6b7280;margin-bottom:.25rem;}
        .field-input{width:100%;border:1px solid #e5e7eb;border-radius:.65rem;padding:.45rem .75rem;font-size:.875rem;outline:none;color:#111827;transition:border-color .2s;}
        .field-input:focus{border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.1);}
      `}</style>
    </DashboardLayout>
  );
};

// ── Sub-components ────────────────────────────────────────────────────────────

const TeamCard = ({ team, active, onClick, onEdit, onDelete }) => (
  <div
    onClick={onClick}
    className={`rounded-xl border p-4 cursor-pointer transition-all select-none ${
      active ? 'shadow-md' : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'
    }`}
    style={active ? { borderColor: team.color, background: team.color + '0a' } : {}}
  >
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-xl flex-shrink-0">{team.icon}</span>
        <div className="min-w-0">
          <p className="font-semibold text-gray-800 text-sm truncate">{team.name}</p>
          <p className="text-xs text-gray-400">{team.memberCount} member{team.memberCount !== 1 ? 's' : ''}</p>
        </div>
      </div>
      {active && (
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={e => { e.stopPropagation(); onEdit(); }}
            className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition">
            <LuPencil size={12}/>
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete(); }}
            className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition">
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
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
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
        <p className="text-gray-500 text-sm text-center py-4">
          All workspace members are already in this team.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <label className="field-label">Select Member</label>
            <div className="relative">
              <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)}
                className="field-input appearance-none pr-7">
                <option value="">Choose a member…</option>
                {candidates.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.department ? `(${m.department})` : ''}
                  </option>
                ))}
              </select>
              <LuChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
            </div>
          </div>
          <div>
            <label className="field-label">Team Role</label>
            <div className="flex gap-2">
              {['member', 'lead'].map(r => (
                <button key={r} type="button" onClick={() => setRole(r)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-sm font-semibold transition ${
                    role === r ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                  {r === 'lead' ? <LuShield size={14}/> : <LuUser size={14}/>}
                  {r === 'lead' ? 'Team Lead' : 'Member'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="btn-ghost flex-1">Cancel</button>
            <button onClick={handleAdd} disabled={adding}
              className="btn-primary flex-1 flex items-center justify-center gap-2">
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
    <h3 className="text-lg font-bold text-gray-700 mb-2">No teams yet</h3>
    <p className="text-gray-400 text-sm mb-6 max-w-xs mx-auto">
      Organise your workspace by creating functional teams — Engineering, Design, Marketing, and more.
    </p>
    <button onClick={onCreateClick} className="btn-primary inline-flex items-center gap-2">
      <LuPlus size={16}/> Create First Team
    </button>
  </div>
);

export default ManageTeams;
