import { supabase } from '../utils/supabaseClient';
import { getAllTasks, normalizeTask } from './taskService';

// ─────────────────────────────────────────────────────────────────────────────
// Analytics Service — Phase 10
// All calculations run client-side from the tasks dataset (no extra DB calls).
// The optional Supabase RPC (calculate_workspace_health) is used if available.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Master analytics fetch — returns everything the Analytics page needs.
 * @param {string} workspaceId
 */
export const getWorkspaceAnalytics = async (workspaceId) => {
  const raw   = await getAllTasks(workspaceId, null);
  const tasks = raw.map(normalizeTask);
  const now   = new Date();

  // ── Status breakdown ───────────────────────────────────────────────────────
  const total      = tasks.length;
  const completed  = tasks.filter(t => t.status === 'Completed').length;
  const inProgress = tasks.filter(t => t.status === 'In Progress').length;
  const pending    = tasks.filter(t => t.status === 'Pending').length;
  const overdue    = tasks.filter(
    t => t.dueDate && new Date(t.dueDate) < now && t.status !== 'Completed'
  ).length;

  // ── Health score (0-100) ───────────────────────────────────────────────────
  // Try server-side RPC first, fallback to client calc
  let healthScore = 100;
  try {
    const { data } = await supabase.rpc('calculate_workspace_health', {
      p_workspace_id: workspaceId,
    });
    if (data !== null && data !== undefined) healthScore = Math.round(data);
  } catch {
    healthScore = total === 0 ? 100 : Math.round(
      Math.max(0, Math.min(100,
        (completed / total) * 40 + (1 - overdue / total) * 60
      ))
    );
  }

  // ── Priority breakdown ─────────────────────────────────────────────────────
  const priorityData = [
    { priority: 'Low',    count: tasks.filter(t => t.priority === 'low').length,    color: '#22c55e' },
    { priority: 'Medium', count: tasks.filter(t => t.priority === 'medium').length, color: '#f59e0b' },
    { priority: 'High',   count: tasks.filter(t => t.priority === 'high').length,   color: '#ef4444' },
  ];

  // ── Workload per member (tasks assigned) ───────────────────────────────────
  const workloadMap = {};
  tasks.forEach(t => {
    if (t.status === 'Completed') return;
    (t.assignedTo || []).forEach(u => {
      const name = u.name || 'Unknown';
      if (!workloadMap[name]) workloadMap[name] = { name, count: 0, avatar: u.profileImageUrl };
      workloadMap[name].count++;
    });
  });
  const workloadData = Object.values(workloadMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // ── Completion trend — last 7 days ────────────────────────────────────────
  const trendData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split('T')[0];
    const label   = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const count   = tasks.filter(t =>
      t.status === 'Completed' &&
      t.createdAt?.startsWith(dateStr)
    ).length;
    return { date: label, completed: count };
  });

  // ── Team performance — tasks completed per person ─────────────────────────
  const perfMap = {};
  tasks.forEach(t => {
    (t.assignedTo || []).forEach(u => {
      const name = u.name || 'Unknown';
      if (!perfMap[name]) perfMap[name] = { name, completed: 0, total: 0, avatar: u.profileImageUrl };
      perfMap[name].total++;
      if (t.status === 'Completed') perfMap[name].completed++;
    });
  });
  const performanceData = Object.values(perfMap)
    .sort((a, b) => b.completed - a.completed)
    .slice(0, 10);

  // ── Status pie data ────────────────────────────────────────────────────────
  const statusData = [
    { status: 'Completed',   count: completed,  color: '#22c55e' },
    { status: 'In Progress', count: inProgress, color: '#6366f1' },
    { status: 'Pending',     count: pending,    color: '#f59e0b' },
    { status: 'Overdue',     count: overdue,    color: '#ef4444' },
  ].filter(d => d.count > 0);

  return {
    summary: { total, completed, inProgress, pending, overdue, healthScore },
    statusData,
    priorityData,
    workloadData,
    performanceData,
    trendData,
    tasks, // raw for exports
  };
};

/**
 * Burndown data — planned remaining vs actual remaining tasks for date range.
 * @param {string} workspaceId
 * @param {Date} startDate
 * @param {Date} endDate
 */
export const getBurndownData = async (workspaceId, startDate, endDate) => {
  const raw   = await getAllTasks(workspaceId, null);
  const tasks = raw.map(normalizeTask);

  const days      = Math.ceil((endDate - startDate) / 86_400_000) + 1;
  const totalWork = tasks.length;
  const idealPerDay = totalWork / (days - 1);

  const data = Array.from({ length: days }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const dayEnd     = new Date(d); dayEnd.setHours(23, 59, 59);
    const dateLabel  = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const ideal      = Math.round(totalWork - idealPerDay * i);
    const remaining  = tasks.filter(
      t => t.status !== 'Completed' ||
           (t.createdAt && new Date(t.createdAt) > dayEnd)
    ).length;
    return { date: dateLabel, ideal, actual: remaining };
  });

  return data;
};
