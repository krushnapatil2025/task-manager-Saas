import { supabase } from "../utils/supabaseClient";

/**
 * Fetch all comments for an intern daily log, including author profiles.
 * @param {string} logId
 */
export const getLogComments = async (logId) => {
  const { data, error } = await supabase
    .from("intern_log_messages")
    .select(`
      id, content, created_at,
      author:profiles(id, name, profile_image_url)
    `)
    .eq("log_id", logId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("getLogComments error:", error);
    throw error;
  }

  return (data || []).map((c) => ({
    id:          c.id,
    content:     c.content,
    createdAt:   c.created_at,
    authorId:    c.author?.id,
    authorName:  c.author?.name || "System", // If author is null, it's a system message
    authorAvatar: c.author?.profile_image_url || null,
  }));
};

/**
 * Add a comment to an intern daily log.
 * @param {string} logId
 * @param {string} userId
 * @param {string} content
 */
export const addLogComment = async (logId, userId, content) => {
  const { data, error } = await supabase
    .from("intern_log_messages")
    .insert({
      log_id:   logId,
      user_id:  userId,
      content:  content.trim(),
    })
    .select(`
      id, content, created_at,
      author:profiles(id, name, profile_image_url)
    `)
    .single();

  if (error) {
    console.error("addLogComment error:", error);
    throw error;
  }

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
 * Delete a comment from an intern daily log.
 * @param {string} commentId
 */
export const deleteLogComment = async (commentId) => {
  const { error } = await supabase
    .from("intern_log_messages")
    .delete()
    .eq("id", commentId);

  if (error) {
    console.error("deleteLogComment error:", error);
    throw error;
  }
};
