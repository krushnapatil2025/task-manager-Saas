import { supabase } from "../utils/supabaseClient";

/**
 * Perform a parallel workspace-scoped search across tasks, chat messages, task comments, task files, and members.
 * @param {string} workspaceId
 * @param {string} query
 */
export const searchAll = async (workspaceId, query) => {
  if (!workspaceId || !query || query.trim().length < 2) {
    return { tasks: [], messages: [], comments: [], files: [], members: [] };
  }

  const cleanQuery = query.trim();

  // 1. Search Tasks (title and description)
  const taskQuery = supabase
    .from("tasks")
    .select("id, title, description, status, priority, due_date")
    .eq("workspace_id", workspaceId)
    .or(`title.ilike.%${cleanQuery}%,description.ilike.%${cleanQuery}%`)
    .limit(10);

  // 2. Search Chat Messages
  const messageQuery = supabase
    .from("chat_messages")
    .select(`
      id, content, created_at, room_id,
      room:chat_rooms!inner(id, name, workspace_id),
      sender:profiles(name, profile_image_url)
    `)
    .eq("room.workspace_id", workspaceId)
    .ilike("content", `%${cleanQuery}%`)
    .limit(10);

  // 3. Search Comments
  const commentQuery = supabase
    .from("task_comments")
    .select(`
      id, content, created_at, task_id,
      task:tasks!inner(id, title, workspace_id),
      author:profiles(id, name, profile_image_url)
    `)
    .eq("task.workspace_id", workspaceId)
    .ilike("content", `%${cleanQuery}%`)
    .limit(10);

  // 4. Search Files
  const fileQuery = supabase
    .from("task_files")
    .select(`
      id, file_name, file_size, mime_type, public_url, created_at, task_id,
      task:tasks(id, title),
      uploader:profiles(id, name)
    `)
    .eq("workspace_id", workspaceId)
    .ilike("file_name", `%${cleanQuery}%`)
    .limit(10);

  // 5. Search Members
  const memberQuery = supabase
    .from("workspace_members")
    .select(`
      role,
      profile:profiles!inner(id, name, profile_image_url, role)
    `)
    .eq("workspace_id", workspaceId)
    .ilike("profile.name", `%${cleanQuery}%`)
    .limit(10);

  try {
    const [tasksRes, messagesRes, commentsRes, filesRes, membersRes] = await Promise.all([
      taskQuery,
      messageQuery,
      commentQuery,
      fileQuery,
      memberQuery
    ]);

    // Handle any specific query errors gracefully
    if (tasksRes.error) console.error("Task search error:", tasksRes.error);
    if (messagesRes.error) console.error("Message search error:", messagesRes.error);
    if (commentsRes.error) console.error("Comment search error:", commentsRes.error);
    if (filesRes.error) console.error("File search error:", filesRes.error);
    if (membersRes.error) console.error("Member search error:", membersRes.error);

    return {
      tasks: tasksRes.data || [],
      messages: messagesRes.data || [],
      comments: commentsRes.data || [],
      files: filesRes.data || [],
      members: (membersRes.data || []).map(m => ({
        id: m.profile?.id,
        name: m.profile?.name,
        profileImageUrl: m.profile?.profile_image_url,
        role: m.role
      }))
    };
  } catch (err) {
    console.error("Global search execution error:", err);
    return { tasks: [], messages: [], comments: [], files: [], members: [] };
  }
};
