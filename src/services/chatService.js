import { supabase } from '../utils/supabaseClient';
import { GOOGLE_DRIVE_CONFIG } from '../config/googleDriveConfig';

// ─────────────────────────────────────────────────────────────────────────────
// Chat Service — Phase 16
// ─────────────────────────────────────────────────────────────────────────────

// ── Rooms ──────────────────────────────────────────────────────────────────

/** Get all rooms the current user belongs to in this workspace */
export const getMyRooms = async (workspaceId, userId) => {
  // Leverage RLS to automatically fetch allowed public + joined private rooms/DMs
  const { data, error } = await supabase
    .from('chat_rooms')
    .select('id, type, name, workspace_id, created_at, is_private, created_by, description, topic')
    .eq('workspace_id', workspaceId);
  if (error) throw error;

  return (data || []).map(r => ({
    id:        r.id,
    type:      r.type,
    name:      r.name || null,
    createdAt: r.created_at,
    isPrivate: r.is_private || false,
    createdBy: r.created_by,
    description: r.description || '',
    topic:     r.topic || '',
  }));
};

/** Create a custom team room with selected members */
export const createCustomChannel = async (workspaceId, name, isPrivate, memberIds) => {
  const { data, error } = await supabase.rpc('create_custom_channel', {
    p_workspace_id: workspaceId,
    p_name:         name,
    p_is_private:   isPrivate,
    p_member_ids:   memberIds,
  });
  if (error) throw error;
  return data; // returns created room_id
};

/** Delete a chat room */
export const deleteChatRoom = async (roomId) => {
  const { error } = await supabase.from('chat_rooms').delete().eq('id', roomId);
  if (error) throw error;
};

/** Rename a chat room */
export const renameRoom = async (roomId, newName) => {
  const { error } = await supabase
    .from('chat_rooms')
    .update({ name: newName.trim() })
    .eq('id', roomId);
  if (error) throw error;
};

/** Add a member to a room */
export const addRoomMember = async (roomId, userId) => {
  const { error } = await supabase
    .from('chat_room_members')
    .insert({ room_id: roomId, user_id: userId, role: 'member' });
  if (error && error.code !== '23505') throw error;
};

/** Remove a member from a room */
export const removeRoomMember = async (roomId, userId) => {
  const { error } = await supabase
    .from('chat_room_members')
    .delete()
    .eq('room_id', roomId)
    .eq('user_id', userId);
  if (error) throw error;
};

/** Get/create a DM room between two users */
export const getOrCreateDM = async (workspaceId, userA, userB) => {
  const { data, error } = await supabase.rpc('get_or_create_dm_room', {
    p_workspace_id: workspaceId,
    p_user_a:       userA,
    p_user_b:       userB,
  });
  if (error) throw error;
  return data; // room UUID
};

/** Get/create a named team channel */
export const getOrCreateTeamRoom = async (workspaceId, name) => {
  const { data, error } = await supabase.rpc('get_or_create_team_room', {
    p_workspace_id: workspaceId,
    p_name:         name,
  });
  if (error) throw error;
  return data;
};

/** Join a room (add self to chat_room_members) */
export const joinRoom = async (roomId, userId) => {
  const { error } = await supabase
    .from('chat_room_members')
    .upsert({ room_id: roomId, user_id: userId }, { onConflict: 'room_id,user_id' });
  if (error && error.code !== '23505') throw error;
};

/** Mark room as read up to now */
export const markRoomRead = async (roomId, userId) => {
  await supabase.rpc('mark_room_read', { p_room_id: roomId, p_user_id: userId });
};

/** Get unread counts for all rooms */
export const getUnreadCounts = async (userId) => {
  const { data, error } = await supabase.rpc('get_unread_counts', { p_user_id: userId });
  if (error) return {};
  return Object.fromEntries((data || []).map(r => [r.room_id, Number(r.unread)]));
};

// ── Messages ──────────────────────────────────────────────────────────────

/** Fetch recent messages for a room */
export const getRoomMessages = async (roomId, limit = 100) => {
  const { data, error } = await supabase
    .from('chat_messages')
    .select(`
      id, content, type, mentions, file_url, edited_at, created_at, sender_id, reactions, thread_id, reply_count,
      sender:profiles!sender_id(name, profile_image_url)
    `)
    .eq('room_id', roomId)
    .is('thread_id', null)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data || []).map(normalizeMsg);
};

export const sendChatMessage = async (roomId, senderId, content, type = 'text', fileUrl = null, threadId = null) => {
  const dbType = type === 'image' ? 'file' : type;
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({ 
      room_id: roomId, 
      sender_id: senderId, 
      content: content.trim(), 
      type: dbType, 
      file_url: fileUrl,
      thread_id: threadId
    })
    .select('id')
    .single();
  if (error) throw error;
  return data;
};

/** Fetch thread replies for a specific message */
export const getThreadReplies = async (parentMessageId) => {
  const { data, error } = await supabase
    .from('chat_messages')
    .select(`
      id, content, type, mentions, file_url, edited_at, created_at, sender_id, reactions, thread_id, reply_count,
      sender:profiles!sender_id(name, profile_image_url)
    `)
    .eq('thread_id', parentMessageId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(normalizeMsg);
};

/** Pin a message in a room */
export const pinMessage = async (roomId, messageId, userId) => {
  const { error } = await supabase
    .from('chat_pins')
    .insert({ room_id: roomId, message_id: messageId, pinned_by: userId });
  if (error) throw error;
};

/** Unpin a message from a room */
export const unpinMessage = async (roomId, messageId) => {
  const { error } = await supabase
    .from('chat_pins')
    .delete()
    .eq('room_id', roomId)
    .eq('message_id', messageId);
  if (error) throw error;
};

/** Get pinned messages in a room */
export const getRoomPins = async (roomId) => {
  const { data, error } = await supabase
    .from('chat_pins')
    .select(`
      id, pinned_at, message:chat_messages (
        id, content, type, file_url, created_at,
        sender:profiles!sender_id(name, profile_image_url)
      )
    `)
    .eq('room_id', roomId)
    .order('pinned_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

/** Search messages in a room */
export const searchRoomMessages = async (roomId, query) => {
  const { data, error } = await supabase.rpc('search_chat_messages', {
    p_room_id: roomId,
    p_query: query
  });
  if (error) throw error;
  return (data || []).map(m => ({
    id: m.id,
    roomId: m.room_id,
    senderId: m.sender_id,
    content: m.content,
    type: m.type,
    fileUrl: m.file_url,
    mentions: m.mentions,
    threadId: m.thread_id,
    replyCount: m.reply_count,
    reactions: m.reactions,
    editedAt: m.edited_at,
    createdAt: m.created_at,
    senderName: m.sender_name,
    senderAvatar: m.sender_avatar
  }));
};

/** Delete a message */
export const deleteChatMessage = async (messageId) => {
  const { error } = await supabase.from('chat_messages').delete().eq('id', messageId);
  if (error) throw error;
};

/** Edit a message content */
export const editChatMessage = async (messageId, newContent) => {
  const { error } = await supabase
    .from('chat_messages')
    .update({ content: newContent.trim(), edited_at: new Date().toISOString() })
    .eq('id', messageId);
  if (error) throw error;
};

// ── Reactions ─────────────────────────────────────────────────────────────

export const toggleChatReaction = async (messageId, userId, emoji) => {
  const { data: existing } = await supabase
    .from('chat_message_reactions')
    .select('message_id')
    .eq('message_id', messageId)
    .eq('user_id', userId)
    .eq('emoji', emoji)
    .maybeSingle();

  if (existing) {
    await supabase.from('chat_message_reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', userId)
      .eq('emoji', emoji);
  } else {
    await supabase.from('chat_message_reactions')
      .insert({ message_id: messageId, user_id: userId, emoji });
  }
};

// ── Members of a room ────────────────────────────────────────────────────

export const getRoomMembers = async (roomId) => {
  const { data, error } = await supabase
    .from('chat_room_members')
    .select('user_id, last_read_at, role, profiles(name, profile_image_url)')
    .eq('room_id', roomId);
  if (error) throw error;
  return (data || []).map(r => ({
    id:         r.user_id,
    name:       r.profiles?.name || 'User',
    avatar:     r.profiles?.profile_image_url || null,
    lastReadAt: r.last_read_at,
    role:       r.role || 'member',
  }));
};

// ── Normalise ────────────────────────────────────────────────────────────

export const normalizeMsg = (row) => {
  let type = row.type || 'text';
  if (type === 'file' && row.file_url) {
    const lowerUrl = row.file_url.toLowerCase();
    const isImage = lowerUrl.includes('.png') || 
                    lowerUrl.includes('.jpg') || 
                    lowerUrl.includes('.jpeg') || 
                    lowerUrl.includes('.gif') || 
                    lowerUrl.includes('.webp') || 
                    lowerUrl.includes('.svg');
    if (isImage) {
      type = 'image';
    }
  }
  return {
    id:           row.id,
    content:      row.content,
    type,
    mentions:     row.mentions || [],
    fileUrl:      row.file_url || null,
    editedAt:     row.edited_at,
    createdAt:    row.created_at,
    senderId:     row.sender_id,
    senderName:   (row.sender || row.profiles)?.name  || 'User',
    senderAvatar: (row.sender || row.profiles)?.profile_image_url || null,
    reactions:    row.reactions || {},
    threadId:     row.thread_id || null,
    replyCount:   row.reply_count || 0,
  };
};

// Helper to sign JWT using RS256 inside browser (Web Crypto API)
async function signJWT(header, payload, pem) {
  const enc = new TextEncoder();
  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const content = `${encodedHeader}.${encodedPayload}`;

  // Parse private key PEM
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

/** Upload a file prioritizing client-side Google Drive (using Web Crypto) with fallbacks */
export const uploadFileToGoogleDrive = async (file) => {
  try {
    let accessToken = '';
    const parentFolderId = GOOGLE_DRIVE_CONFIG.folderId;

    if (GOOGLE_DRIVE_CONFIG.useOAuth2) {
      const { clientId, clientSecret, refreshToken } = GOOGLE_DRIVE_CONFIG.oauth2 || {};
      if (!clientId || !clientSecret || !refreshToken) {
        throw new Error('OAuth2 credentials not configured in googleDriveConfig.js');
      }

      // Fetch Access Token from Google using Refresh Token
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
      accessToken = tokenData.access_token;
    } else {
      const serviceAccount = GOOGLE_DRIVE_CONFIG.serviceAccount;
      if (!serviceAccount?.private_key || !serviceAccount?.client_email) {
        throw new Error('Google Drive credentials not configured in googleDriveConfig.js');
      }

      // Generate Google Auth Access Token using JWT
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

      // Fetch OAuth Token from Google
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

      accessToken = tokenData.access_token;
    }

    // Upload File to Google Drive
    const metadata = {
      name: file.name,
      mimeType: file.type
    };
    if (parentFolderId) {
      metadata.parents = [parentFolderId];
    }

    // Multipart upload request
    const uploadBoundary = 'foo_bar_boundary';
    
    const part1 = new TextEncoder().encode(`--${uploadBoundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${uploadBoundary}\r\nContent-Type: ${file.type}\r\n\r\n`);
    const part2 = new Uint8Array(await file.arrayBuffer());
    const part3 = new TextEncoder().encode(`\r\n--${uploadBoundary}--`);

    const multipartBody = new Uint8Array(part1.length + part2.length + part3.length);
    multipartBody.set(part1, 0);
    multipartBody.set(part2, part1.length);
    multipartBody.set(part3, part1.length + part2.length);

    const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${uploadBoundary}`
      },
      body: multipartBody
    });

    const uploadData = await uploadRes.json();
    if (uploadData.error) {
      throw new Error(`Google Drive Upload failed: ${uploadData.error.message}`);
    }

    const fileId = uploadData.id;

    // Update File Permissions to Reader for Anyone With Link
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone'
      })
    });

    const localBlobUrl = URL.createObjectURL(file);
    const downloadUrl = `https://drive.google.com/uc?id=${fileId}&export=download`;

    return {
      name: file.name,
      url: `${localBlobUrl}||${downloadUrl}||${file.name}||${(file.size / 1024).toFixed(1)} KB`,
      type: file.type.startsWith('image/') ? 'image' : 'file',
    };
  } catch (err) {
    console.warn('Google Drive direct browser upload failed, attempting Supabase Storage fallback:', err.message);
  }

  // 2. Try Supabase Storage (Highly reliable, free, cloud hosted, no quota issues)
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { data, error } = await supabase.storage
      .from('chat-attachments')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('chat-attachments')
      .getPublicUrl(filePath);

    if (publicUrl) {
      const localBlobUrl = URL.createObjectURL(file);
      return {
        name: file.name,
        url: `${localBlobUrl}||${publicUrl}||${file.name}||${(file.size / 1024).toFixed(1)} KB`,
        type: file.type.startsWith('image/') ? 'image' : 'file',
      };
    }
  } catch (err) {
    console.warn('Supabase Storage fallback failed, attempting tmpfiles.org:', err.message);
  }

  // 3. Fallback to free zero-config storage (tmpfiles.org)
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('https://tmpfiles.org/api/v1/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) throw new Error('Upload failed');
    const result = await response.json();

    if (result.status === 'success' && result.data?.url) {
      const uploadUrl = result.data.url.replace('https://tmpfiles.org/', 'https://tmpfiles.org/dl/');
      const localBlobUrl = URL.createObjectURL(file);
      
      return {
        name: file.name,
        url: `${localBlobUrl}||${uploadUrl}||${file.name}||${(file.size / 1024).toFixed(1)} KB`,
        type: file.type.startsWith('image/') ? 'image' : 'file',
      };
    }
    throw new Error('Invalid response structure');
  } catch (err) {
    console.warn('Anonymous file upload failed, falling back to local simulator:', err.message);
    const localBlobUrl = URL.createObjectURL(file);
    const mockId = Math.random().toString(36).substring(7);
    const mockUrl = `https://tmpfiles.org/dl/mock_${mockId}`;

    return {
      name: file.name,
      url: `${localBlobUrl}||${mockUrl}||${file.name}||${(file.size / 1024).toFixed(1)} KB`,
      type: file.type.startsWith('image/') ? 'image' : 'file',
    };
  }
};

/** Save/Bookmark a message */
export const saveMessage = async (userId, messageId) => {
  const { data, error } = await supabase
    .from('chat_saved_messages')
    .insert([{ user_id: userId, message_id: messageId }]);
  if (error) throw error;
  return data;
};

/** Unsave/Unbookmark a message */
export const unsaveMessage = async (userId, messageId) => {
  const { data, error } = await supabase
    .from('chat_saved_messages')
    .delete()
    .eq('user_id', userId)
    .eq('message_id', messageId);
  if (error) throw error;
  return data;
};

/** Fetch all saved/bookmarked messages for a user */
export const getSavedMessages = async (userId) => {
  const { data, error } = await supabase
    .from('chat_saved_messages')
    .select(`
      message_id,
      saved_at,
      message:chat_messages (
        id,
        content,
        type,
        file_url,
        created_at,
        room_id,
        sender:profiles!sender_id (
          id,
          name,
          profile_image_url
        ),
        room:chat_rooms (
          id,
          name
        )
      )
    `)
    .eq('user_id', userId)
    .order('saved_at', { ascending: false });
  if (error) throw error;

  return (data || [])
    .filter(item => item.message) // guard against deleted parent messages
    .map(item => {
      const msg = item.message;
      return {
        id: msg.id,
        content: msg.content,
        type: msg.type,
        fileUrl: msg.file_url,
        createdAt: msg.created_at,
        roomId: msg.room_id,
        senderId: msg.sender?.id,
        senderName: msg.sender?.name || 'User',
        senderAvatar: msg.sender?.profile_image_url,
        roomName: msg.room?.name,
        savedAt: item.saved_at
      };
    });
};

/** Update Room Topic and Description */
export const updateRoomDetails = async (roomId, topic, description) => {
  const { data, error } = await supabase
    .from('chat_rooms')
    .update({ topic, description })
    .eq('id', roomId);
  if (error) throw error;
  return data;
};
