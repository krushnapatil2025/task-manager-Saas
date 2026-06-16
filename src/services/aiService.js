import { supabase } from '../utils/supabaseClient';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL   = 'llama3-8b-8192';

// ─────────────────────────────────────────────────────────────────────────────
// Low-level Groq call
// ─────────────────────────────────────────────────────────────────────────────
const callGroq = async (systemPrompt, userMessage) => {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) throw new Error('VITE_GROQ_API_KEY is not set in .env');

  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.3,
      max_tokens: 512,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage  },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Groq API error ${res.status}`);
  }

  const json = await res.json();
  return json.choices?.[0]?.message?.content?.trim() || '';
};

// ─────────────────────────────────────────────────────────────────────────────
// Store AI interaction history (fire-and-forget)
// ─────────────────────────────────────────────────────────────────────────────
const logInteraction = (workspaceId, userId, type, input, output, accepted = null) => {
  supabase.from('ai_interactions').insert({
    workspace_id: workspaceId,
    user_id:      userId,
    type,
    input,
    output,
    accepted,
  }).then(() => {}).catch(() => {});
};

// ─────────────────────────────────────────────────────────────────────────────
// 9.1 — Suggest priority + reason from title + description
// Returns: { priority: 'low'|'medium'|'high', reason: string }
// ─────────────────────────────────────────────────────────────────────────────
export const suggestTaskPriority = async (title, description, workspaceId, userId) => {
  const system = `You are a project management AI assistant. Analyze task details and respond ONLY with valid JSON. No markdown, no explanation — just JSON.`;
  const user   = `Task title: "${title}"\nDescription: "${description}"\n\nRespond ONLY with: {"priority":"low"|"medium"|"high","reason":"one sentence max 15 words"}`;

  const raw    = await callGroq(system, user);
  const parsed = JSON.parse(raw);
  logInteraction(workspaceId, userId, 'suggestion', `${title} | ${description}`, parsed);
  return parsed;
};

// ─────────────────────────────────────────────────────────────────────────────
// 9.2 — Summarise all comments of a task into a TL;DR
// Returns: { bullets: string[], summary: string }
// ─────────────────────────────────────────────────────────────────────────────
export const summariseTaskComments = async (taskTitle, comments, workspaceId, userId) => {
  if (!comments?.length) return { bullets: ['No comments yet.'], summary: 'No discussion activity.' };

  const commentText = comments.map((c, i) => `${i + 1}. ${c.author}: "${c.text}"`).join('\n');
  const system = `You are a concise project management AI. Summarise task discussion into exactly 3 bullet points and a one-line summary. Respond ONLY with valid JSON.`;
  const user   = `Task: "${taskTitle}"\n\nComments:\n${commentText}\n\nRespond ONLY with: {"bullets":["point1","point2","point3"],"summary":"one sentence"}`;

  const raw    = await callGroq(system, user);
  const parsed = JSON.parse(raw);
  logInteraction(workspaceId, userId, 'summary', commentText, parsed);
  return parsed;
};

// ─────────────────────────────────────────────────────────────────────────────
// 9.3 — Smart deadline / workload warnings for a workspace
// tasks: array of { title, status, due_date, assignees }
// Returns: string[] of warning messages
// ─────────────────────────────────────────────────────────────────────────────
export const getSmartWarnings = async (tasks, workspaceId, userId) => {
  const today  = new Date().toISOString().split('T')[0];
  const tmrw   = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];

  // Compute locally — no AI call needed, deterministic
  const warnings = [];

  const overdue = tasks.filter(
    t => t.due_date && t.due_date < today && t.status !== 'Completed'
  );
  const dueTomorrow = tasks.filter(
    t => t.due_date?.startsWith(tmrw) && t.status !== 'Completed'
  );
  const unassigned = tasks.filter(
    t => (!t.assignees || t.assignees.length === 0) && t.status !== 'Completed'
  );

  // Workload per assignee
  const workload = {};
  tasks.forEach(t => {
    if (t.status === 'Completed') return;
    (t.assignees || []).forEach(a => {
      const name = a.user?.name || a.name || 'Unknown';
      workload[name] = (workload[name] || 0) + 1;
    });
  });
  const overloaded = Object.entries(workload).filter(([, count]) => count >= 8);

  if (overdue.length)     warnings.push(`🔴 ${overdue.length} task${overdue.length > 1 ? 's are' : ' is'} overdue`);
  if (dueTomorrow.length) warnings.push(`⏰ ${dueTomorrow.length} task${dueTomorrow.length > 1 ? 's' : ''} due tomorrow`);
  if (unassigned.length)  warnings.push(`⚠️ ${unassigned.length} task${unassigned.length > 1 ? 's are' : ' is'} unassigned`);
  overloaded.forEach(([name, count]) =>
    warnings.push(`📊 ${name} has ${count} active tasks — consider reassigning`)
  );

  logInteraction(workspaceId, userId, 'suggestion', 'smart_warnings', { warnings });
  return warnings;
};

// ─────────────────────────────────────────────────────────────────────────────
// 9.4 — Natural language task creation
// Input: "Create a high priority bug fix for login page due Friday assigned to dev team"
// Returns: { title, description, priority, dueDateOffset, assigneeHint }
// ─────────────────────────────────────────────────────────────────────────────
export const parseNaturalLanguageTask = async (input, workspaceId, userId) => {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const system = `You are a task management AI. Parse the user's natural language into a structured task. Today is ${today}. Respond ONLY with valid JSON — no markdown.`;
  const user   = `Parse this into a task: "${input}"\n\nRespond ONLY with:\n{"title":"short task title","description":"expanded description 1-2 sentences","priority":"low"|"medium"|"high","dueDateOffset":0,"assigneeHint":"team or person name or null"}\n\ndueDateOffset = days from today (e.g. Friday = 4 if today is Monday).`;

  const raw    = await callGroq(system, user);
  const parsed = JSON.parse(raw);
  logInteraction(workspaceId, userId, 'nlp_create', input, parsed);
  return parsed;
};

// ─────────────────────────────────────────────────────────────────────────────
// 9.5 — Summarise channel/chat activity for the last 24 hours
// messages: array of recent chat messages
// Returns: string (formatted Markdown summary)
// ─────────────────────────────────────────────────────────────────────────────
export const summariseChannelActivity = async (roomName, messages, workspaceId, userId) => {
  if (!messages?.length) return 'No conversation history found in the last 24 hours.';

  const chatText = messages.map(m => `${m.senderName || 'User'}: "${m.content || ''}"`).join('\n');
  const system = `You are a helpful project manager AI assistant. You summarize team chat logs to highlight key discussions, decisions made, action items, and general status updates. Output a beautiful, friendly markdown summary.`;
  const user = `Summarize the recent chat logs for channel #${roomName || 'general'}:\n\n${chatText}\n\nPlease include sections for "🔑 Key Discussions", "✅ Decisions Made", and "📋 Action Items" if any. Keep it professional yet engaging.`;

  const raw = await callGroq(system, user);
  logInteraction(workspaceId, userId, 'channel_summary', chatText, { summary: raw });
  return raw;
};
