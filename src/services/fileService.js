import { supabase } from "../utils/supabaseClient";

// ─────────────────────────────────────────────────────────────────────────────
// File Upload Service — Supabase Storage for task attachments
// ─────────────────────────────────────────────────────────────────────────────

const BUCKET = "task-attachments";

/**
 * Upload a file to Supabase Storage and record it in task_files.
 * @param {File}   file
 * @param {string} taskId
 * @param {string} workspaceId
 * @param {string} uploadedBy   userId of the uploader
 * @returns {Promise<object>}   The new task_files row
 */
export const uploadTaskFile = async (file, taskId, workspaceId, uploadedBy) => {
  // Unique path: workspace/task/timestamp-filename
  const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath  = `${workspaceId}/${taskId}/${Date.now()}-${safeFilename}`;

  // 1. Upload to Storage
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { cacheControl: "3600", upsert: false });

  if (uploadErr) throw uploadErr;

  // 2. Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(storagePath);

  // 3. Record in task_files
  const { data, error: dbErr } = await supabase
    .from("task_files")
    .insert({
      task_id:      taskId,
      workspace_id: workspaceId,
      uploaded_by:  uploadedBy,
      file_name:    file.name,
      file_size:    file.size,
      mime_type:    file.type,
      storage_path: storagePath,
      public_url:   publicUrl,
    })
    .select()
    .single();

  if (dbErr) throw dbErr;
  return data;
};

/**
 * Get all files attached to a task.
 * @param {string} taskId
 */
export const getTaskFiles = async (taskId) => {
  const { data, error } = await supabase
    .from("task_files")
    .select(`
      id, file_name, file_size, mime_type, public_url, created_at,
      uploader:profiles(id, name)
    `)
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map((f) => ({
    id:           f.id,
    fileName:     f.file_name,
    fileSize:     f.file_size,
    mimeType:     f.mime_type,
    publicUrl:    f.public_url,
    createdAt:    f.created_at,
    uploaderName: f.uploader?.name,
    uploaderId:   f.uploader?.id,
  }));
};

/**
 * Delete a file from Storage and the task_files table.
 * @param {string} fileId       UUID of the task_files row
 * @param {string} storagePath  Path in Supabase Storage
 */
export const deleteTaskFile = async (fileId, storagePath) => {
  // Remove from storage
  await supabase.storage.from(BUCKET).remove([storagePath]);

  // Remove from DB
  const { error } = await supabase
    .from("task_files")
    .delete()
    .eq("id", fileId);

  if (error) throw error;
};

/** Format file size to human-readable string */
export const formatFileSize = (bytes) => {
  if (!bytes) return "—";
  if (bytes < 1024)          return `${bytes} B`;
  if (bytes < 1024 * 1024)   return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** Return a suitable icon name based on MIME type */
export const getMimeIcon = (mime = "") => {
  if (mime.startsWith("image/"))       return "image";
  if (mime === "application/pdf")      return "pdf";
  if (mime.includes("spreadsheet") || mime.includes("excel")) return "excel";
  if (mime.includes("word"))           return "word";
  return "file";
};

/**
 * Get all files uploaded in a workspace, joined with task title and uploader details.
 * @param {string} workspaceId
 */
export const getWorkspaceFiles = async (workspaceId) => {
  const { data, error } = await supabase
    .from("task_files")
    .select(`
      id, file_name, file_size, mime_type, public_url, storage_path, created_at,
      task:tasks(id, title),
      uploader:profiles(id, name)
    `)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []).map((f) => ({
    id:           f.id,
    fileName:     f.file_name,
    fileSize:     f.file_size,
    mimeType:     f.mime_type,
    publicUrl:    f.public_url,
    storagePath:  f.storage_path,
    createdAt:    f.created_at,
    taskId:       f.task?.id,
    taskTitle:    f.task?.title,
    uploaderName: f.uploader?.name,
    uploaderId:   f.uploader?.id,
  }));
};
