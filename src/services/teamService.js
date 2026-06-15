import { supabase } from '../utils/supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// Team Service — multi-team workspace support (Phase F)
// ─────────────────────────────────────────────────────────────────────────────

/** Fetch all teams in a workspace with member counts */
export const getTeams = async (workspaceId) => {
  const { data, error } = await supabase
    .from('teams')
    .select(`
      id, name, description, color, icon, created_at,
      created_by,
      creator:profiles!created_by(name),
      team_members(user_id)
    `)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(t => ({
    id:           t.id,
    name:         t.name,
    description:  t.description,
    color:        t.color || '#6366f1',
    icon:         t.icon  || '👥',
    createdAt:    t.created_at,
    createdByName: t.creator?.name || 'Unknown',
    memberCount:  t.team_members?.length || 0,
    memberIds:    (t.team_members || []).map(m => m.user_id),
  }));
};

/** Fetch all members of a specific team with profile details */
export const getTeamMembers = async (teamId) => {
  const { data, error } = await supabase
    .from('team_members')
    .select(`
      role, joined_at,
      profile:profiles(id, name, profile_image_url, job_profile, department, status)
    `)
    .eq('team_id', teamId);

  if (error) throw error;
  return (data || []).map(m => ({
    userId:          m.profile?.id,
    name:            m.profile?.name,
    profileImageUrl: m.profile?.profile_image_url,
    jobProfile:      m.profile?.job_profile,
    department:      m.profile?.department,
    status:          m.profile?.status,
    teamRole:        m.role, // 'lead' | 'member'
    joinedAt:        m.joined_at,
  }));
};

/** Create a new team */
export const createTeam = async (workspaceId, { name, description, color, icon }) => {
  const { data, error } = await supabase
    .from('teams')
    .insert({ workspace_id: workspaceId, name, description, color, icon })
    .select()
    .single();
  if (error) throw error;
  return data;
};

/** Update team metadata */
export const updateTeam = async (teamId, { name, description, color, icon }) => {
  const { error } = await supabase
    .from('teams')
    .update({ name, description, color, icon })
    .eq('id', teamId);
  if (error) throw error;
};

/** Delete a team (cascades team_members) */
export const deleteTeam = async (teamId) => {
  const { error } = await supabase.from('teams').delete().eq('id', teamId);
  if (error) throw error;
};

/** Add a user to a team */
export const addTeamMember = async (teamId, userId, role = 'member') => {
  const { error } = await supabase
    .from('team_members')
    .insert({ team_id: teamId, user_id: userId, role });
  if (error) throw error;
};

/** Remove a user from a team */
export const removeTeamMember = async (teamId, userId) => {
  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('team_id', teamId)
    .eq('user_id', userId);
  if (error) throw error;
};

/** Change a team member's role (lead ↔ member) */
export const updateTeamMemberRole = async (teamId, userId, role) => {
  const { error } = await supabase
    .from('team_members')
    .update({ role })
    .eq('team_id', teamId)
    .eq('user_id', userId);
  if (error) throw error;
};
