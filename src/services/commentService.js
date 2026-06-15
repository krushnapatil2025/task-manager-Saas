import { supabase } from "../utils/supabaseClient";

// ─────────────────────────────────────────────────────────────────────────────
// Comment Service — all Supabase queries for task comments
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all comments for a task with author profile.
 * @param {string} taskId
 */
export const getComments = async (taskId) => {
  const { data, error } = await supabase
    .from("task_comments")
    .select(`
      id, content, created_at, updated_at,
      author:profiles(id, name, profile_image_url)
    `)
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data || []).map((c) => ({
    id:          c.id,
    content:     c.content,
    createdAt:   c.created_at,
    updatedAt:   c.updated_at,
    authorId:    c.author?.id,
    authorName:  c.author?.name,
    authorAvatar: c.author?.profile_image_url,
  }));
};

/**
 * Add a comment to a task.
 * @param {string} taskId
 * @param {string} workspaceId
 * @param {string} authorId
 * @param {string} content
 */
export const addComment = async (taskId, workspaceId, authorId, content) => {
  const { data, error } = await supabase
    .from("task_comments")
    .insert({
      task_id:      taskId,
      workspace_id: workspaceId,
      author_id:    authorId,
      content:      content.trim(),
    })
    .select(`
      id, content, created_at,
      author:profiles(id, name, profile_image_url)
    `)
    .single();

  if (error) throw error;

  return {
    id:           data.id,
    content:      data.content,
    createdAt:    data.created_at,
    authorId:     data.author?.id,
    authorName:   data.author?.name,
    authorAvatar: data.author?.profile_image_url,
  };
};

/**
 * Delete a comment (only the author can do this — enforced by RLS).
 * @param {string} commentId
 */
export const deleteComment = async (commentId) => {
  const { error } = await supabase
    .from("task_comments")
    .delete()
    .eq("id", commentId);

  if (error) throw error;
};

/**
 * Edit a comment (only the author can do this — enforced by RLS).
 * @param {string} commentId
 * @param {string} newContent
 */
export const editComment = async (commentId, newContent) => {
  const { error } = await supabase
    .from("task_comments")
    .update({ content: newContent.trim() })
    .eq("id", commentId);

  if (error) throw error;
};
