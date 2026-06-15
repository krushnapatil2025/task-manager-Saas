// =============================================================================
// Supabase Edge Function: api-tasks
// Deploy: supabase functions deploy api-tasks
//
// Public REST API for tasks — authenticated via X-API-Key header.
// Only available to workspaces on the Enterprise plan.
//
// Endpoints:
//   GET    /functions/v1/api-tasks          → list tasks
//   GET    /functions/v1/api-tasks/:id      → get single task
//   POST   /functions/v1/api-tasks          → create task
//   PATCH  /functions/v1/api-tasks/:id      → update task status
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-API-Key, Authorization",
};

Deno.serve(async (req: Request) => {
  // ── CORS preflight ──────────────────────────────────────────────────────
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ── Auth: validate API key ──────────────────────────────────────────────
  const apiKey = req.headers.get("X-API-Key");
  if (!apiKey || !apiKey.startsWith("tf_")) {
    return json({ error: "Missing or invalid API key. Include X-API-Key header." }, 401);
  }

  // Hash the key using SHA-256
  const keyHash = await hashKey(apiKey);

  // Use service role client to bypass RLS for the validate_api_key call
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: keyData, error: keyErr } = await supabaseAdmin
    .rpc("validate_api_key", { p_key_hash: keyHash });

  if (keyErr || !keyData?.length) {
    return json({ error: "Invalid, expired, or inactive API key." }, 401);
  }

  const { workspace_id: workspaceId, scopes } = keyData[0];

  // ── Route: parse URL path ─────────────────────────────────────────────
  const url      = new URL(req.url);
  const segments = url.pathname.replace(/^\/functions\/v1\/api-tasks\/?/, "").split("/").filter(Boolean);
  const taskId   = segments[0] || null;

  // ── Use authenticated client (scoped by workspace via RLS) ────────────
  // Note: We use service role but manually scope by workspace_id in every query.
  const sb = supabaseAdmin;

  try {
    // ── GET /api-tasks ── list tasks ──────────────────────────────────────
    if (req.method === "GET" && !taskId) {
      const status   = url.searchParams.get("status");
      const priority = url.searchParams.get("priority");
      const limit    = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);

      let query = sb
        .from("tasks")
        .select("id, title, description, status, priority, due_date, progress, created_at")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (status)   query = query.eq("status", status);
      if (priority) query = query.eq("priority", priority);

      const { data, error } = await query;
      if (error) throw error;
      return json({ data, meta: { workspace_id: workspaceId, count: data.length } });
    }

    // ── GET /api-tasks/:id ── single task ─────────────────────────────────
    if (req.method === "GET" && taskId) {
      const { data, error } = await sb
        .from("tasks")
        .select("*, todo_checklist(*)")
        .eq("id", taskId)
        .eq("workspace_id", workspaceId)
        .single();

      if (error) throw error;
      return json({ data });
    }

    // ── POST /api-tasks ── create task ───────────────────────────────────
    if (req.method === "POST") {
      if (!scopes.includes("tasks:write")) {
        return json({ error: "API key does not have tasks:write scope." }, 403);
      }

      const body = await req.json();
      const { title, description, priority = "low", due_date, status = "Pending" } = body;

      if (!title) return json({ error: "title is required." }, 400);

      const { data, error } = await sb
        .from("tasks")
        .insert({ title, description, priority, due_date, status, workspace_id: workspaceId })
        .select()
        .single();

      if (error) throw error;
      return json({ data }, 201);
    }

    // ── PATCH /api-tasks/:id ── update status ────────────────────────────
    if (req.method === "PATCH" && taskId) {
      if (!scopes.includes("tasks:write")) {
        return json({ error: "API key does not have tasks:write scope." }, 403);
      }

      const body   = await req.json();
      const update: Record<string, unknown> = {};
      if (body.status)      update.status      = body.status;
      if (body.priority)    update.priority    = body.priority;
      if (body.description) update.description = body.description;

      const { data, error } = await sb
        .from("tasks")
        .update(update)
        .eq("id", taskId)
        .eq("workspace_id", workspaceId)
        .select()
        .single();

      if (error) throw error;
      return json({ data });
    }

    return json({ error: "Method not allowed." }, 405);

  } catch (err) {
    console.error("[api-tasks] error:", err);
    return json({ error: err.message || "Internal server error." }, 500);
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hashKey(key: string): Promise<string> {
  const encoded = new TextEncoder().encode(key);
  const hash    = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
