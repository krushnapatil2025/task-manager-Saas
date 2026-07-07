import { supabase } from "../utils/supabaseClient";
import { uploadFileToGoogleDrive } from "./chatService";
import { GOOGLE_DRIVE_CONFIG } from "../config/googleDriveConfig";

// ─────────────────────────────────────────────────────────────────────────────
// File Upload Service — Google Drive for task attachments
// ─────────────────────────────────────────────────────────────────────────────

// Helper to sign JWT using RS256 inside browser (Web Crypto API)
async function signJWT(header, payload, pem) {
  const enc = new TextEncoder();
  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const content = `${encodedHeader}.${encodedPayload}`;

  const pemHeader = "-----BEGIN PRIVATE KEY-----";
  const pemFooter = "-----END PRIVATE KEY-----";
  let pemContents = pem.trim();
  if (pemContents.startsWith(pemHeader)) {
    pemContents = pemContents.substring(pemHeader.length);
  }
  if (pemContents.endsWith(pemFooter)) {
    pemContents = pemContents.substring(0, pemContents.length - pemFooter.length);
  }
  pemContents = pemContents.replace(/\s/g, "");

  const binaryDerString = atob(pemContents);
  const binaryDer = new Uint8Array(binaryDerString.length);
  for (let i = 0; i < binaryDerString.length; i++) {
    binaryDer[i] = binaryDerString.charCodeAt(i);
  }

  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    enc.encode(content)
  );

  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  return `${content}.${encodedSignature}`;
}

async function getGoogleDriveAccessToken() {
  if (GOOGLE_DRIVE_CONFIG.useOAuth2) {
    const { clientId, clientSecret, refreshToken } = GOOGLE_DRIVE_CONFIG.oauth2 || {};
    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('OAuth2 credentials not configured in googleDriveConfig.js');
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    });

    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      throw new Error(`Google OAuth2 Refresh error: ${tokenData.error_description || tokenData.error}`);
    }
    return tokenData.access_token;
  } else {
    const serviceAccount = GOOGLE_DRIVE_CONFIG.serviceAccount;
    if (!serviceAccount?.private_key || !serviceAccount?.client_email) {
      throw new Error('Google Drive credentials not configured in googleDriveConfig.js');
    }

    const jwtHeader = { alg: 'RS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const jwtClaim = {
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/drive.file',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    };

    const privateKeyPEM = serviceAccount.private_key.replace(/\\n/g, '\n');
    const token = await signJWT(jwtHeader, jwtClaim, privateKeyPEM);

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: token
      })
    });

    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      throw new Error(`Google Auth error: ${tokenData.error_description || tokenData.error}`);
    }

    return tokenData.access_token;
  }
}

export const deleteFileFromGoogleDrive = async (fileId) => {
  const accessToken = await getGoogleDriveAccessToken();
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  if (!res.ok && res.status !== 404) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Failed to delete file ${fileId} from Google Drive`);
  }
};

/**
 * Upload a file to Google Drive and record it in task_files.
 * @param {File}   file
 * @param {string} taskId
 * @param {string} workspaceId
 * @param {string} uploadedBy   userId of the uploader
 * @returns {Promise<object>}   The new task_files row
 */
export const uploadTaskFile = async (file, taskId, workspaceId, uploadedBy) => {
  // 1. Upload to Google Drive using the shared chat integration function
  const driveResult = await uploadFileToGoogleDrive(file);
  
  if (!driveResult || !driveResult.url) {
    throw new Error("Google Drive upload failed");
  }

  // Parse returned url payload: localBlobUrl||downloadUrl||fileName||fileSize
  const parts = driveResult.url.split("||");
  const downloadUrl = parts[1];
  const fileName = parts[2] || file.name;

  // Extract Google Drive File ID from downloadUrl
  let fileId = "";
  try {
    const urlObj = new URL(downloadUrl);
    fileId = urlObj.searchParams.get("id") || "";
  } catch (e) {
    console.error("Failed to parse fileId from downloadUrl:", e);
  }

  const storagePath = fileId ? `google-drive:${fileId}` : `google-drive:${Date.now()}`;

  // 2. Record in task_files
  const { data, error: dbErr } = await supabase
    .from("task_files")
    .insert({
      task_id:      taskId,
      workspace_id: workspaceId,
      uploaded_by:  uploadedBy,
      file_name:    fileName,
      file_size:    file.size,
      mime_type:    file.type,
      storage_path: storagePath,
      public_url:   downloadUrl,
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
      id, file_name, file_size, mime_type, public_url, storage_path, created_at,
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
    storagePath:  f.storage_path,
    createdAt:    f.created_at,
    uploaderName: f.uploader?.name,
    uploaderId:   f.uploader?.id,
  }));
};

/**
 * Delete a file from Storage and the task_files table.
 * @param {string} fileId       UUID of the task_files row
 * @param {string} storagePath  Path in Supabase Storage or Google Drive file ID
 */
export const deleteTaskFile = async (fileId, storagePath) => {
  // If it's a Google Drive file, delete it from Google Drive
  if (storagePath && storagePath.startsWith("google-drive:")) {
    const googleFileId = storagePath.replace("google-drive:", "");
    try {
      await deleteFileFromGoogleDrive(googleFileId);
    } catch (err) {
      console.warn("Failed to delete file from Google Drive (it might be deleted already or permissions restricted):", err);
    }
  } else {
    // Fallback to legacy Supabase Storage delete if not Google Drive
    try {
      await supabase.storage.from("task-attachments").remove([storagePath]);
    } catch (err) {
      console.warn("Failed to remove file from Supabase storage fallback:", err);
    }
  }

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
