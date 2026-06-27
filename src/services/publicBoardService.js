import { supabase } from '../utils/supabaseClient';

/**
 * Generate a public shareable board link
 */
export const createPublicLink = async (workspaceId, sprintId = null, password = null, expiresAt = null) => {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('public_board_links')
    .insert({
      workspace_id: workspaceId,
      sprint_id: sprintId,
      password_hash: password || null,
      expires_at: expiresAt || null,
      created_by: user?.id || null
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

/**
 * Fetch public board tasks and metadata by token (and optional password)
 */
export const getPublicBoard = async (token, password = null) => {
  const { data, error } = await supabase.rpc('get_public_board', {
    p_token: token,
    p_password: password || null
  });

  if (error) throw error;
  return data?.[0] || null; // returns { workspace_name, sprint_title, tasks: [...] }
};

/**
 * Check if the link exists and requires a password / is expired
 */
export const checkPublicLinkStatus = async (token) => {
  const { data, error } = await supabase
    .from('public_board_links')
    .select('id, expires_at, password_hash')
    .eq('token', token)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { exists: false };

  return {
    exists: true,
    requiresPassword: !!data.password_hash,
    isExpired: data.expires_at ? new Date(data.expires_at) < new Date() : false
  };
};
