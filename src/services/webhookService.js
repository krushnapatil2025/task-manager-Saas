import { supabase } from "../utils/supabaseClient";

// ─────────────────────────────────────────────────────────────────────────────
// Webhook Service — manage workspace webhook endpoints
// ─────────────────────────────────────────────────────────────────────────────

export const WEBHOOK_EVENTS = [
  "task.created",
  "task.status_changed",
  "task.deleted",
  "member.added",
  "member.removed",
  "member.invited",
];

/**
 * Create a new webhook.
 */
export const createWebhook = async (workspaceId, createdBy, { name, url, events }) => {
  const { data, error } = await supabase
    .from("webhooks")
    .insert({ workspace_id: workspaceId, created_by: createdBy, name, url, events })
    .select()
    .single();
  if (error) throw error;
  return data;
};

/**
 * Get all webhooks for a workspace.
 */
export const getWebhooks = async (workspaceId) => {
  const { data, error } = await supabase
    .from("webhooks")
    .select("id, name, url, events, secret, is_active, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
};

/**
 * Toggle a webhook active/inactive.
 */
export const toggleWebhook = async (webhookId, isActive) => {
  const { error } = await supabase
    .from("webhooks")
    .update({ is_active: isActive })
    .eq("id", webhookId);
  if (error) throw error;
};

/**
 * Delete a webhook.
 */
export const deleteWebhook = async (webhookId) => {
  const { error } = await supabase.from("webhooks").delete().eq("id", webhookId);
  if (error) throw error;
};

/**
 * Get recent deliveries for a webhook.
 */
export const getWebhookDeliveries = async (webhookId, limit = 20) => {
  const { data, error } = await supabase
    .from("webhook_deliveries")
    .select("id, event, status_code, success, delivered_at, response")
    .eq("webhook_id", webhookId)
    .order("delivered_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
};
