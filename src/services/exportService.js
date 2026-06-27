import { getAllTasks, normalizeTask } from "./taskService";

// ─────────────────────────────────────────────────────────────────────────────
// Export Service — CSV, iCal, and JSON exports for workspace tasks
// ─────────────────────────────────────────────────────────────────────────────

/** Trigger a browser file download. */
const downloadFile = (content, filename, mimeType) => {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

// ── CSV export ────────────────────────────────────────────────────────────────

/**
 * Export all tasks in a workspace as a CSV file.
 * @param {string} workspaceId
 * @param {string} workspaceName   Used in the filename
 */
export const exportTasksCSV = async (workspaceId, workspaceName = "workspace") => {
  const raw   = await getAllTasks(workspaceId, null);
  const tasks = raw.map(normalizeTask);

  const header = ["ID", "Title", "Description", "Status", "Priority", "Progress", "Due Date", "Assigned To", "Created At"];
  const rows   = tasks.map((t) => [
    t.id,
    `"${(t.title || "").replace(/"/g, '""')}"`,
    `"${(t.description || "").replace(/"/g, '""')}"`,
    t.status,
    t.priority,
    `${t.progress}%`,
    t.dueDate ? new Date(t.dueDate).toLocaleDateString("en-GB") : "",
    `"${(t.assignedTo || []).map((u) => u.name).join(", ")}"`,
    new Date(t.createdAt).toLocaleDateString("en-GB"),
  ]);

  const csv = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
  downloadFile(csv, `${workspaceName}_tasks_${Date.now()}.csv`, "text/csv;charset=utf-8;");
};

// ── JSON export ───────────────────────────────────────────────────────────────

/**
 * Export all tasks as a JSON file (full data dump).
 */
export const exportTasksJSON = async (workspaceId, workspaceName = "workspace") => {
  const raw   = await getAllTasks(workspaceId, null);
  const tasks = raw.map(normalizeTask);
  const json  = JSON.stringify({ workspace_id: workspaceId, exported_at: new Date().toISOString(), tasks }, null, 2);
  downloadFile(json, `${workspaceName}_tasks_${Date.now()}.json`, "application/json");
};

// ── iCal export ───────────────────────────────────────────────────────────────

/**
 * Export tasks with due dates as an iCal (.ics) file.
 * Compatible with Google Calendar, Apple Calendar, Outlook.
 */
export const exportTasksICal = async (workspaceId, workspaceName = "workspace") => {
  const raw   = await getAllTasks(workspaceId, null);
  const tasks = raw.map(normalizeTask).filter((t) => t.dueDate);

  const now    = formatICalDate(new Date());
  const UID_NS = `taskflow-${workspaceId}`;

  const events = tasks.map((t) => {
    const due     = new Date(t.dueDate);
    const dueStr  = formatICalDate(due);
    const summary = (t.title || "").replace(/[\\;,]/g, "\\$&");
    const desc    = (t.description || "").replace(/[\\;,]/g, "\\$&").replace(/\n/g, "\\n");

    return [
      "BEGIN:VEVENT",
      `UID:${UID_NS}-${t.id}`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${dueStr.slice(0, 8)}`,
      `DTEND;VALUE=DATE:${dueStr.slice(0, 8)}`,
      `SUMMARY:[${t.status}] ${summary}`,
      `DESCRIPTION:Priority: ${t.priority}\\n${desc}`,
      `STATUS:${t.status === "Completed" ? "COMPLETED" : "NEEDS-ACTION"}`,
      `PRIORITY:${t.priority === "high" ? 1 : t.priority === "medium" ? 5 : 9}`,
      "END:VEVENT",
    ].join("\r\n");
  });

  const ical = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TaskFlow//TaskFlow Calendar//EN",
    `X-WR-CALNAME:${workspaceName} Tasks`,
    "X-WR-TIMEZONE:Asia/Kolkata",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");

  downloadFile(ical, `${workspaceName}_tasks_${Date.now()}.ics`, "text/calendar;charset=utf-8;");
};

/** Format a Date as iCal timestamp: YYYYMMDDTHHMMSSZ */
const formatICalDate = (date) =>
  date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

// ── Chat History export ────────────────────────────────────────────────────────
import { getRoomMessages } from "./chatService";

/** Export chat room/direct message history as a JSON file. */
export const exportChatHistoryJSON = async (roomId, roomName = "chat") => {
  const cleanName = roomName.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
  try {
    const messages = await getRoomMessages(roomId, 1000);
    const json = JSON.stringify({
      room_id: roomId,
      room_name: roomName,
      exported_at: new Date().toISOString(),
      messages: messages.map(m => ({
        id: m.id,
        sender: m.senderName,
        content: m.content,
        type: m.type,
        fileUrl: m.fileUrl,
        createdAt: m.createdAt
      }))
    }, null, 2);
    downloadFile(json, `${cleanName}_history_${Date.now()}.json`, "application/json");
  } catch (err) {
    console.error("Failed to export chat history JSON:", err);
    throw err;
  }
};

/** Export chat room/direct message history as a CSV file. */
export const exportChatHistoryCSV = async (roomId, roomName = "chat") => {
  const cleanName = roomName.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_');
  try {
    const messages = await getRoomMessages(roomId, 1000);
    const header = ["Message ID", "Sender", "Content", "Type", "File URL", "Created At"];
    const rows = messages.map(m => [
      m.id,
      `"${(m.senderName || "").replace(/"/g, '""')}"`,
      `"${(m.content || "").replace(/"/g, '""')}"`,
      m.type,
      m.fileUrl || "",
      m.createdAt
    ]);

    const csv = [header.join(","), ...rows.map(r => r.join(","))].join("\n");
    downloadFile(csv, `${cleanName}_history_${Date.now()}.csv`, "text/csv;charset=utf-8;");
  } catch (err) {
    console.error("Failed to export chat history CSV:", err);
    throw err;
  }
};
