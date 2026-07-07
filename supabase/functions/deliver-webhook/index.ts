// =============================================================================
// Supabase Edge Function: deliver-webhook
// Deploy: supabase functions deploy deliver-webhook --no-verify-jwt
//
// Processes pending webhook_deliveries rows and POSTs them to the target URL.
// Slack incoming webhook URLs get a rich Block Kit message automatically.
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SupabaseClient = ReturnType<typeof createClient>;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch up to 50 pending (never-attempted) delivery jobs
    const { data: deliveries, error: fetchErr } = await sb
      .from("webhook_deliveries")
      .select("id, webhook_id, event, payload")
      .eq("success", false)
      .is("status_code", null)
      .limit(50);

    if (fetchErr) {
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!deliveries || deliveries.length === 0) {
      return new Response(JSON.stringify({ delivered: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let delivered = 0;

    await Promise.allSettled(
      deliveries.map(async (d) => {
        const { data: wh } = await sb
          .from("webhooks")
          .select("url, secret, is_active")
          .eq("id", d.webhook_id)
          .single();

        if (!wh || !wh.is_active) return;

        const isSlack = wh.url.includes("hooks.slack.com");

        // For Slack: build rich Block Kit message.
        // For others: send the raw event payload.
        const outPayload = isSlack
          ? await buildSlackPayload(d.event, d.payload, sb)
          : d.payload;

        const body      = JSON.stringify(outPayload);
        const signature = await hmacSign(body, wh.secret);

        let status_code = 0;
        let response    = "";
        let success     = false;

        try {
          const res = await fetch(wh.url, {
            method: "POST",
            headers: {
              "Content-Type":         "application/json",
              "X-Strideo-Event":     d.event,
              "X-Strideo-Signature": signature,
              "X-Strideo-Delivery":  d.id,
            },
            body,
            signal: AbortSignal.timeout(10_000),
          });

          status_code = res.status;
          response    = (await res.text()).slice(0, 500);
          success     = res.ok;
          if (success) delivered++;
        } catch (err) {
          response = (err as Error).message || "Network error";
        }

        await sb
          .from("webhook_deliveries")
          .update({ status_code, response, success, delivered_at: new Date().toISOString() })
          .eq("id", d.id);
      }),
    );

    return new Response(JSON.stringify({ delivered, total: deliveries.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// =============================================================================
// Enterprise Slack Block Kit payload builder
// =============================================================================
async function buildSlackPayload(
  event: string,
  payload: Record<string, unknown>,
  sb: SupabaseClient,
) {
  if (event.startsWith("holiday.")) {
    const holiday     = (payload?.holiday ?? {}) as Record<string, unknown>;
    const holidayName = (holiday.name        as string)  || "Public Holiday";
    const holidayDate = holiday.date          as string;
    const isOptional  = holiday.is_optional   as boolean;
    const description = holiday.description   as string | null;

    // ── Dates ────────────────────────────────────────────────────────────────
    const dateObj = holidayDate ? new Date(holidayDate) : null;

    const fullDateStr = dateObj
      ? dateObj.toLocaleDateString("en-US", {
          weekday: "long", day: "numeric", month: "long", year: "numeric",
        })
      : "—";

    const dayOfWeek = dateObj
      ? dateObj.toLocaleDateString("en-US", { weekday: "long" })
      : "—";

    // ── Config per action ────────────────────────────────────────────────────
    const isAdded = event === "holiday.created";
    const cfg = isAdded
      ? { label: "Public Holiday Added",   emoji: "🌴", color: "#10b981", action: "A new public holiday has been added to the workspace calendar." }
      : { label: "Public Holiday Removed", emoji: "🗑️",  color: "#ef4444", action: "A public holiday has been removed from the workspace calendar." };

    const holidayTypeBadge = isOptional ? "🟡  Optional Holiday" : "🟢  Public Holiday";

    // ── Blocks ───────────────────────────────────────────────────────────────
    const blocks: unknown[] = [];

    // 1. Header
    blocks.push({
      type: "header",
      text: { type: "plain_text", text: `${cfg.emoji}  ${cfg.label}  ·  Strideo HR`, emoji: true },
    });

    // 2. Intro context
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: cfg.action },
    });

    blocks.push({ type: "divider" });

    // 3. Holiday name
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: isAdded
          ? `*📅  ${holidayName}*\n_Team members may plan their schedules accordingly._`
          : `*📅  ~~${holidayName}~~*\n_This holiday has been removed from the workspace._`,
      },
    });

    // 4. Details fields
    blocks.push({
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*📆  Date*\n${fullDateStr}` },
        { type: "mrkdwn", text: `*📋  Type*\n${holidayTypeBadge}` },
        { type: "mrkdwn", text: `*🗓️  Day of Week*\n${dayOfWeek}` },
        { type: "mrkdwn", text: `*⏱️  Recorded At*\n${new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}` },
      ],
    });

    // 5. Description (if any)
    if (description && description.trim()) {
      blocks.push({ type: "divider" });
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: `*📝  Note*\n>${description.trim().replace(/\n/g, "\n>")}` },
      });
    }

    // 6. Optional / Deleted advisory
    if (isAdded && isOptional) {
      blocks.push({
        type: "context",
        elements: [
          { type: "mrkdwn", text: "ℹ️  *Optional Holiday* — employees may choose to take this day off at their own discretion." },
        ],
      });
    } else if (!isAdded) {
      blocks.push({
        type: "context",
        elements: [
          { type: "mrkdwn", text: "⚠️  If you had planned leave around this date, please consult your manager." },
        ],
      });
    }

    blocks.push({ type: "divider" });

    // 7. Footer
    blocks.push({
      type: "context",
      elements: [
        { type: "mrkdwn", text: `🏢 *Strideo Enterprise HR*  ·  Leave & Holiday Management  ·  Workspace Calendar` },
      ],
    });

    return {
      text: `[Strideo HR] ${cfg.label}: ${holidayName} — ${fullDateStr}`,
      blocks,
      attachments: [{ color: cfg.color, fallback: `${cfg.label}: ${holidayName} on ${fullDateStr}` }],
    };
  }


  if (event.startsWith("leave.")) {
    const leave = (payload?.leave ?? {}) as Record<string, unknown>;
    const applicantName = (payload?.applicant_name as string) || "Unknown Employee";
    const leaveType = (payload?.leave_type as string) || "Leave";
    const startDate = leave.start_date as string;
    const endDate = leave.end_date as string;
    const totalDays = leave.total_days as number;
    const reason = (leave.reason as string) || "No reason provided";
    const status = (leave.status as string) || "pending";
    const isHalfDay = leave.is_half_day as boolean;
    const session = leave.half_day_session as string | null;

    const dateStr = startDate && endDate
      ? (startDate === endDate
          ? new Date(startDate).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
          : `${new Date(startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${new Date(endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`)
      : "—";

    const durationStr = `${totalDays} Day${totalDays !== 1 ? "s" : ""}${isHalfDay ? ` (Half-day ${session ?? ""})` : ""}`;

    const cfg = event === "leave.created"
      ? { label: "New Leave Application", emoji: "🌴", color: "#6366f1" }
      : { label: `Leave Application ${status.toUpperCase()}`, emoji: status === "approved" ? "✅" : "❌", color: status === "approved" ? "#10b981" : "#ef4444" };

    const blocks: unknown[] = [
      {
        type: "header",
        text: { type: "plain_text", text: `${cfg.emoji}  ${cfg.label}  ·  Strideo`, emoji: true },
      },
      { type: "divider" },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*Employee:* ${applicantName}\n*Leave Type:* ${leaveType}` },
        fields: [
          { type: "mrkdwn", text: `*Duration*\n${durationStr}` },
          { type: "mrkdwn", text: `*Dates*\n${dateStr}` },
        ],
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*Reason:*\n>${reason.replace(/\n/g, "\n>")}` },
      },
    ];

    if (event === "leave.status_changed") {
      const comment = leave.review_comment as string | null;
      if (comment && comment.trim()) {
        blocks.push({
          type: "section",
          text: { type: "mrkdwn", text: `*Manager Comment:*\n>${comment.replace(/\n/g, "\n>")}` },
        });
      }
    }

    blocks.push(
      { type: "divider" },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `🏢 *Strideo Enterprise*  ·  ${new Date().toLocaleString("en-US")}`,
          },
        ],
      }
    );

    return {
      text: `[Strideo] ${cfg.label}: ${applicantName} - ${leaveType} (${durationStr})`,
      blocks,
      attachments: [{ color: cfg.color, fallback: `${cfg.label}: ${applicantName} - ${leaveType}` }],
    };
  }

  const task        = (payload?.task       ?? {}) as Record<string, unknown>;
  const taskId      = task.id      as string | undefined;
  const title       = (task.title       as string) || "Untitled Task";
  const description = (task.description as string) || "";
  const priority    = (task.priority    as string) || "low";
  const status      = (task.status      as string) || "—";
  const progress    = (task.progress    as number) ?? 0;
  const dueDate     = task.due_date as string | null;
  const rawAttach   = (task.attachments as string[]) || [];

  // assignees + subtasks come from the enriched payload (set by DB trigger).
  // For task.created, assignments are added AFTER the task row, so the trigger
  // captures an empty array — we re-fetch here to get the actual list.
  let assignees: Array<{ name: string; job_profile: string }> =
    (payload.assignees as Array<{ name: string; job_profile: string }>) || [];

  let subtasks: Array<{ title: string; completed: boolean }> =
    (payload.subtasks as Array<{ title: string; completed: boolean }>) || [];

  // Re-fetch for task.created (assignments weren't created yet when the trigger fired)
  if (taskId && event === "task.created" && assignees.length === 0) {
    const { data } = await sb
      .from("task_assignments")
      .select("user:profiles(name, job_profile)")
      .eq("task_id", taskId);
    assignees = (data || []).map((r: any) => ({
      name:        r.user?.name        || "Unknown",
      job_profile: r.user?.job_profile || "",
    }));
  }

  // Re-fetch subtasks for task.created too
  if (taskId && event === "task.created" && subtasks.length === 0) {
    const { data } = await sb
      .from("todo_checklist")
      .select("title, completed")
      .eq("task_id", taskId)
      .order("sort_order", { ascending: true });
    subtasks = (data || []) as Array<{ title: string; completed: boolean }>;
  }

  // ── Event config ──────────────────────────────────────────────────────────
  const eventConfig: Record<string, { label: string; emoji: string; color: string }> = {
    "task.created":          { label: "Task Created",            emoji: "🆕", color: "#22c55e" },
    "task.deleted":          { label: "Task Deleted",            emoji: "🗑️",  color: "#ef4444" },
    "task.status_changed":   { label: "Task Status Updated",     emoji: "🔄", color: "#3b82f6" },
    "member.added":          { label: "Member Added",            emoji: "👤", color: "#8b5cf6" },
    "member.removed":        { label: "Member Removed",          emoji: "👤", color: "#f97316" },
    "member.invited":        { label: "Member Invited",          emoji: "📧", color: "#06b6d4" },
    "leave.created":         { label: "New Leave Application",   emoji: "🌴", color: "#6366f1" },
    "leave.status_changed":  { label: "Leave Status Updated",    emoji: "📋", color: "#10b981" },
    "holiday.created":       { label: "Public Holiday Added",    emoji: "🎉", color: "#10b981" },
    "holiday.deleted":       { label: "Public Holiday Deleted",  emoji: "🗑️", color: "#ef4444" },
  };
  const cfg = eventConfig[event] ?? { label: event, emoji: "📌", color: "#6b7280" };

  // ── Priority badge ────────────────────────────────────────────────────────
  const priorityDisplay: Record<string, string> = {
    high:   "🔴 High",
    medium: "🟡 Medium",
    low:    "🟢 Low",
  };
  const pLabel = priorityDisplay[priority.toLowerCase()] ?? priority;

  // ── Due date ─────────────────────────────────────────────────────────────
  const dueDateStr = dueDate
    ? new Date(dueDate).toLocaleDateString("en-US", {
        weekday: "short", day: "numeric", month: "short", year: "numeric",
      })
    : null;

  // ── Completed subtask count ───────────────────────────────────────────────
  const completedCount = subtasks.filter((s) => s.completed).length;

  // ── Progress bar (10 blocks) ──────────────────────────────────────────────
  const filled  = Math.round(progress / 10);
  const progBar = "█".repeat(filled) + "░".repeat(10 - filled);

  // ── Timestamp ────────────────────────────────────────────────────────────
  const now = new Date().toLocaleString("en-US", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Block Kit blocks
  // ══════════════════════════════════════════════════════════════════════════
  const blocks: unknown[] = [];

  // ── 1. Header ─────────────────────────────────────────────────────────────
  blocks.push({
    type: "header",
    text: { type: "plain_text", text: `${cfg.emoji}  ${cfg.label}  ·  Strideo`, emoji: true },
  });

  blocks.push({ type: "divider" });

  // ── 2. Task title + meta fields ───────────────────────────────────────────
  const metaFields: unknown[] = [
    { type: "mrkdwn", text: `*Priority*\n${pLabel}` },
    { type: "mrkdwn", text: `*Status*\n${status}` },
  ];
  if (event !== "task.deleted") {
    metaFields.push({ type: "mrkdwn", text: `*Progress*\n\`${progBar}\` ${progress}%` });
  }
  if (dueDateStr) {
    metaFields.push({ type: "mrkdwn", text: `*Due Date*\n📅 ${dueDateStr}` });
  }

  blocks.push({
    type: "section",
    text: { type: "mrkdwn", text: `*📋 ${title}*` },
    fields: metaFields,
  });

  // ── 3. Description ────────────────────────────────────────────────────────
  if (description.trim()) {
    blocks.push({ type: "divider" });
    const truncated = description.length > 400
      ? description.slice(0, 400) + "…"
      : description;
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*📝 Description*\n>${truncated.replace(/\n/g, "\n>")}`,
      },
    });
  }

  // ── 4. Assigned Members ───────────────────────────────────────────────────
  blocks.push({ type: "divider" });
  if (assignees.length > 0) {
    const memberList = assignees
      .map((a) => `• *${a.name}*${a.job_profile ? `  _${a.job_profile}_` : ""}`)
      .join("\n");
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*👥 Assigned Members  (${assignees.length})*\n${memberList}`,
      },
    });
  } else {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*👥 Assigned Members*\n_No members assigned_` },
    });
  }

  // ── 5. Subtasks / Checklist ───────────────────────────────────────────────
  blocks.push({ type: "divider" });
  if (subtasks.length > 0) {
    const subtaskList = subtasks
      .map((s) => `${s.completed ? "✅" : "⬜"} ${s.title}`)
      .join("\n");
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*☑️ Subtasks  (${completedCount} / ${subtasks.length} completed)*\n${subtaskList}`,
      },
    });
  } else {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*☑️ Subtasks*\n_No subtasks_` },
    });
  }

  // ── 6. Attachments / Links ────────────────────────────────────────────────
  blocks.push({ type: "divider" });
  if (rawAttach.length > 0) {
    const linkList = rawAttach
      .map((url) => {
        const label = url.length > 60 ? url.slice(0, 57) + "…" : url;
        return `• <${url}|${label}>`;
      })
      .join("\n");
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*🔗 Links & Attachments  (${rawAttach.length})*\n${linkList}`,
      },
    });
  } else {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*🔗 Links & Attachments*\n_No attachments_` },
    });
  }

  // ── 7. Footer ─────────────────────────────────────────────────────────────
  blocks.push({ type: "divider" });
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `🏢 *Strideo Enterprise*  ·  ${now}${taskId ? `  ·  ID: \`${taskId.slice(0, 8)}…\`` : ""}`,
      },
    ],
  });

  // ── Slack attachment (colored left bar) ───────────────────────────────────
  return {
    text: `[Strideo] ${cfg.label}: ${title}`,   // fallback / notification preview
    blocks,
    attachments: [{ color: cfg.color, fallback: `${cfg.label}: ${title}` }],
  };
}

// ── HMAC-SHA256 signing ───────────────────────────────────────────────────────
async function hmacSign(body: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return "sha256=" + Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
