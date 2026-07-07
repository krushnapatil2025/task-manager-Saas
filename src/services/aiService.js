import { supabase } from '../utils/supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// AI Service — OpenAI GPT-5.4 mini
// ─────────────────────────────────────────────────────────────────────────────

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-5.4-mini';

// ── Low-level OpenAI call ────────────────────────────────────────────────────
const callOpenAI = async (messages, options = {}) => {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey || apiKey === 'your_openai_api_key_here') {
    throw new Error('OpenAI API key not configured. Please set VITE_OPENAI_API_KEY in your .env file.');
  }

  const res = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: options.temperature ?? 0.4,
      max_completion_tokens: options.max_tokens ?? 800,
      messages,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message || `OpenAI API error ${res.status}`;
    // Surface friendly messages for common errors
    if (res.status === 401) throw new Error('Invalid OpenAI API key. Check VITE_OPENAI_API_KEY in .env');
    if (res.status === 429) throw new Error('Rate limit exceeded — please wait a moment and try again.');
    if (res.status === 402) throw new Error('OpenAI quota exceeded. Check your billing at platform.openai.com');
    throw new Error(msg);
  }

  const json = await res.json();
  return json.choices?.[0]?.message?.content?.trim() || '';
};

// ── Store AI interaction history (fire-and-forget) ──────────────────────────
const logInteraction = (workspaceId, userId, type, input, output, accepted = null) => {
  let dbType = 'suggestion';
  if (type === 'nlp_create' || type === 'chat' || type === 'expand_desc') {
    dbType = 'nlp_create';
  } else if (type === 'summary' || type === 'channel_summary') {
    dbType = 'summary';
  }

  let dbOutput = output;
  if (typeof output === 'string') {
    dbOutput = { text: output };
  } else if (output === null || output === undefined) {
    dbOutput = {};
  }

  supabase.from('ai_interactions').insert({
    workspace_id: workspaceId,
    user_id: userId,
    type: dbType,
    input: typeof input === 'string' ? input : JSON.stringify(input),
    output: dbOutput,
    accepted,
  }).then(() => { }).catch(() => { });
};

// ── Safe JSON parse ──────────────────────────────────────────────────────────
const safeParseJSON = (raw) => {
  // Strip markdown code fences if any
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(cleaned);
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. Suggest task priority from title + description
// Returns: { priority: 'low'|'medium'|'high', reason: string }
// ─────────────────────────────────────────────────────────────────────────────
export const suggestTaskPriority = async (title, description, workspaceId, userId) => {
  const messages = [
    {
      role: 'system',
      content: 'You are a project management AI assistant. Analyze the task details and respond ONLY with valid JSON. No markdown, no explanation.',
    },
    {
      role: 'user',
      content: `Task title: "${title}"\nDescription: "${description}"\n\nRespond ONLY with: {"priority":"low"|"medium"|"high","reason":"one sentence max 15 words"}`,
    },
  ];

  const raw = await callOpenAI(messages, { temperature: 0.3, max_tokens: 120 });
  const parsed = safeParseJSON(raw);
  logInteraction(workspaceId, userId, 'suggestion', `${title} | ${description}`, parsed);
  return parsed;
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. Summarise task comments into a TL;DR
// Returns: { bullets: string[], summary: string }
// ─────────────────────────────────────────────────────────────────────────────
export const summariseTaskComments = async (taskTitle, comments, workspaceId, userId) => {
  if (!comments?.length) return { bullets: ['No comments yet.'], summary: 'No discussion activity.' };

  const commentText = comments.map((c, i) => `${i + 1}. ${c.author}: "${c.text}"`).join('\n');
  const messages = [
    {
      role: 'system',
      content: 'You are a concise project management AI. Summarise task discussion into exactly 3 bullet points and a one-line summary. Respond ONLY with valid JSON.',
    },
    {
      role: 'user',
      content: `Task: "${taskTitle}"\n\nComments:\n${commentText}\n\nRespond ONLY with: {"bullets":["point1","point2","point3"],"summary":"one sentence"}`,
    },
  ];

  const raw = await callOpenAI(messages, { temperature: 0.3, max_tokens: 200 });
  const parsed = safeParseJSON(raw);
  logInteraction(workspaceId, userId, 'summary', commentText, parsed);
  return parsed;
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. Smart workspace warnings (deterministic — no AI needed)
// Returns: string[] of warning messages
// ─────────────────────────────────────────────────────────────────────────────
export const getSmartWarnings = async (tasks, workspaceId, userId) => {
  const today = new Date().toISOString().split('T')[0];
  const tmrw = new Date(Date.now() + 86_400_000).toISOString().split('T')[0];
  const warnings = [];

  const overdue = tasks.filter(t => t.due_date && t.due_date < today && t.status !== 'Completed');
  const dueTomorrow = tasks.filter(t => t.due_date?.startsWith(tmrw) && t.status !== 'Completed');
  const unassigned = tasks.filter(t => (!t.assignees || t.assignees.length === 0) && t.status !== 'Completed');

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

  if (overdue.length) warnings.push(`🔴 ${overdue.length} task${overdue.length > 1 ? 's are' : ' is'} overdue`);
  if (dueTomorrow.length) warnings.push(`⏰ ${dueTomorrow.length} task${dueTomorrow.length > 1 ? 's' : ''} due tomorrow`);
  if (unassigned.length) warnings.push(`⚠️ ${unassigned.length} task${unassigned.length > 1 ? 's are' : ' is'} unassigned`);
  overloaded.forEach(([name, count]) =>
    warnings.push(`📊 ${name} has ${count} active tasks — consider reassigning`)
  );

  logInteraction(workspaceId, userId, 'suggestion', 'smart_warnings', { warnings });
  return warnings;
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. Natural language task creation
// Returns: { title, description, priority, dueDateOffset, assigneeHint }
// ─────────────────────────────────────────────────────────────────────────────
export const parseNaturalLanguageTask = async (input, workspaceId, userId) => {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const messages = [
    {
      role: 'system',
      content: `You are a task management AI. Parse the user's natural language into a structured task. Today is ${today}. Respond ONLY with valid JSON — no markdown.`,
    },
    {
      role: 'user',
      content: `Parse this into a task: "${input}"\n\nRespond ONLY with:\n{"title":"short task title","description":"expanded description 1-2 sentences","priority":"low"|"medium"|"high","dueDateOffset":0,"assigneeHint":"team or person name or null"}\n\ndueDateOffset = days from today (e.g. Friday = 4 if today is Monday).`,
    },
  ];

  const raw = await callOpenAI(messages, { temperature: 0.3, max_tokens: 200 });
  const parsed = safeParseJSON(raw);
  logInteraction(workspaceId, userId, 'nlp_create', input, parsed);
  return parsed;
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. Summarise channel/chat activity
// Returns: string (formatted Markdown summary)
// ─────────────────────────────────────────────────────────────────────────────
export const summariseChannelActivity = async (roomName, messages, workspaceId, userId) => {
  if (!messages?.length) return 'No conversation history found in the last 24 hours.';

  const chatText = messages.map(m => `${m.senderName || 'User'}: "${m.content || ''}"`).join('\n');
  const aiMessages = [
    {
      role: 'system',
      content: 'You are a helpful project manager AI assistant. Summarize team chat logs to highlight key discussions, decisions, and action items. Output a clean, professional markdown summary.',
    },
    {
      role: 'user',
      content: `Summarize recent chat for channel #${roomName || 'general'}:\n\n${chatText}\n\nInclude sections: "🔑 Key Discussions", "✅ Decisions Made", and "📋 Action Items". Keep it concise and professional.`,
    },
  ];

  const raw = await callOpenAI(aiMessages, { temperature: 0.5, max_tokens: 500 });
  logInteraction(workspaceId, userId, 'channel_summary', chatText, { summary: raw });
  return raw;
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. CONVERSATIONAL CHAT — multi-turn assistant
// conversationHistory: [{ role: 'user'|'assistant', content: string }]
// workspaceContext: { name, taskCount, pendingCount }
// Returns: string (AI reply)
// ─────────────────────────────────────────────────────────────────────────────
export const chatWithAssistant = async (conversationHistory, workspaceContext, workspaceId, userId) => {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const systemPrompt = `You are Aria, an intelligent AI assistant built into Strideo — a professional task management platform. Today is ${today}.

Current workspace: "${workspaceContext?.name || 'Unknown'}"
${workspaceContext?.taskCount != null ? `Active tasks in workspace: ${workspaceContext.taskCount}` : ''}
${workspaceContext?.pendingCount != null ? `Pending tasks: ${workspaceContext.pendingCount}` : ''}

Your capabilities:
- Help users create, plan, and prioritize tasks
- Answer questions about productivity and project management
- Suggest how to use Strideo features (Kanban board, Sprint planning, Calendar, Goals/OKRs, Team Chat)
- Write task descriptions, subtasks, and acceptance criteria
- Give advice on team collaboration and workload management
- Analyze productivity patterns and suggest improvements

Personality: Friendly, concise, professional. Use short paragraphs. Use markdown sparingly (bullet lists are fine). Always be helpful and action-oriented.

Navigation paths you know:
- Dashboard: /admin/dashboard
- Kanban Board: /admin/kanban
- Sprint Board: /admin/sprints
- Calendar: /admin/calendar
- Manage Tasks: /admin/tasks
- Analytics: /admin/analytics
- Goals & OKRs: /admin/goals
- Team Chat: /chat`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
  ];

  const reply = await callOpenAI(messages, { temperature: 0.6, max_tokens: 600 });
  logInteraction(workspaceId, userId, 'chat', conversationHistory.at(-1)?.content || '', reply);
  return reply;
};

// ─────────────────────────────────────────────────────────────────────────────
// 7. Generate task subtasks/checklist from title + description
// Returns: { checklist: string[] }
// ─────────────────────────────────────────────────────────────────────────────
export const generateTaskChecklist = async (title, description, workspaceId, userId) => {
  const messages = [
    {
      role: 'system',
      content: 'You are a project management AI. Generate a practical checklist of 4-6 actionable subtasks for the given task. Respond ONLY with valid JSON.',
    },
    {
      role: 'user',
      content: `Task: "${title}"\nDescription: "${description || 'No description'}"\n\nRespond ONLY with: {"checklist":["step 1","step 2","step 3","step 4"]}`,
    },
  ];

  const raw = await callOpenAI(messages, { temperature: 0.5, max_tokens: 250 });
  const parsed = safeParseJSON(raw);
  logInteraction(workspaceId, userId, 'checklist_gen', `${title}`, parsed);
  return parsed;
};

// ─────────────────────────────────────────────────────────────────────────────
// 8. Write a professional task description from a short summary
// Returns: string (expanded description)
// ─────────────────────────────────────────────────────────────────────────────
export const expandTaskDescription = async (shortSummary, workspaceId, userId) => {
  const messages = [
    {
      role: 'system',
      content: 'You are a project management AI. Expand the user\'s brief task summary into a clear, professional 2-3 sentence task description suitable for a project management tool. Include the scope and expected outcome.',
    },
    {
      role: 'user',
      content: `Brief summary: "${shortSummary}"\n\nWrite a professional task description (2-3 sentences, no markdown):`,
    },
  ];

  const reply = await callOpenAI(messages, { temperature: 0.5, max_tokens: 150 });
  logInteraction(workspaceId, userId, 'expand_desc', shortSummary, reply);
  return reply;
};
