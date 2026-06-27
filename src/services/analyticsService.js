import { supabase } from '../utils/supabaseClient';
import { getAllTasks, normalizeTask } from './taskService';
import { getSprints, getSprintTasks } from './sprintService';

// ─────────────────────────────────────────────────────────────────────────────
// Analytics Service — Upgraded to V2
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Master analytics fetch V2 — supports date filtering, agility stats, team leaderboards, cycle times, and OKRs.
 * @param {string} workspaceId
 * @param {string} startDateStr - YYYY-MM-DD
 * @param {string} endDateStr - YYYY-MM-DD
 */
export const getWorkspaceAnalyticsV2 = async (workspaceId, startDateStr, endDateStr) => {
  // 1. Fetch raw tasks
  const raw = await getAllTasks(workspaceId, null);
  const tasks = raw.map(normalizeTask);
  const startLimit = startDateStr ? new Date(startDateStr) : null;
  const endLimit = endDateStr ? new Date(endDateStr) : null;
  if (endLimit) endLimit.setHours(23, 59, 59, 999);

  // Filter tasks created or modified within the date range
  const filteredTasks = tasks.filter(t => {
    const created = new Date(t.createdAt);
    if (startLimit && created < startLimit) return false;
    if (endLimit && created > endLimit) return false;
    return true;
  });

  const total = filteredTasks.length;
  const completed = filteredTasks.filter(t => t.status === 'Completed').length;
  const inProgress = filteredTasks.filter(t => t.status === 'In Progress').length;
  const pending = filteredTasks.filter(t => t.status === 'Pending').length;

  const now = new Date();
  const overdue = filteredTasks.filter(
    t => t.dueDate && new Date(t.dueDate) < now && t.status !== 'Completed'
  ).length;

  // 2. Health Score
  let healthScore = 100;
  healthScore = total === 0 ? 100 : Math.round(
    Math.max(0, Math.min(100,
      (completed / total) * 40 + (1 - overdue / total) * 60
    ))
  );

  // 3. Priority Breakdown
  const priorityData = [
    { name: 'Low',    count: filteredTasks.filter(t => t.priority === 'low').length,    color: '#22c55e' },
    { name: 'Medium', count: filteredTasks.filter(t => t.priority === 'medium').length, color: '#f59e0b' },
    { name: 'High',   count: filteredTasks.filter(t => t.priority === 'high').length,   color: '#ef4444' },
  ];

  // 4. Status Breakdown
  const statusData = [
    { name: 'Completed',   value: completed,  color: '#22c55e' },
    { name: 'In Progress', value: inProgress, color: '#6366f1' },
    { name: 'Pending',     value: pending,    color: '#f59e0b' },
    { name: 'Overdue',     value: overdue,    color: '#ef4444' },
  ].filter(d => d.value > 0);

  // 5. Completion Trend (grouped by day)
  const dateMap = {};
  // Initialize date map for date range
  if (startLimit && endLimit) {
    let curr = new Date(startLimit);
    while (curr <= endLimit) {
      const key = curr.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dateMap[key] = { date: key, completed: 0, created: 0 };
      curr.setDate(curr.getDate() + 1);
    }
  } else {
    // Default last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dateMap[key] = { date: key, completed: 0, created: 0 };
    }
  }

  filteredTasks.forEach(t => {
    const createdKey = new Date(t.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (dateMap[createdKey]) {
      dateMap[createdKey].created++;
    }
  });

  // Query audit logs to find exact completion times if available, otherwise fallback
  let auditLogs = [];
  try {
    const { data: logs } = await supabase
      .from('audit_logs')
      .select('resource_id, created_at, metadata')
      .eq('workspace_id', workspaceId)
      .eq('action', 'task.status_changed');
    auditLogs = logs || [];
  } catch (err) {
    console.warn("Could not fetch audit logs:", err);
  }

  const completionTimes = {};
  const progressTimes = {};

  auditLogs.forEach(log => {
    const taskId = log.resource_id;
    const newStatus = log.metadata?.new_status;
    if (newStatus === 'Completed') {
      completionTimes[taskId] = new Date(log.created_at);
    } else if (newStatus === 'In Progress') {
      progressTimes[taskId] = new Date(log.created_at);
    }
  });

  filteredTasks.forEach(t => {
    if (t.status === 'Completed') {
      const compDate = completionTimes[t.id] || new Date(t.createdAt);
      const compKey = compDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (dateMap[compKey]) {
        dateMap[compKey].completed++;
      }
    }
  });

  const trendData = Object.values(dateMap);

  // 6. Cycle Time Distribution & Leaderboard
  let totalCycleTime = 0;
  let cycleTimeCount = 0;
  const cycleTimeBuckets = {
    '0-1 Day': 0,
    '2-3 Days': 0,
    '4-7 Days': 0,
    '8-14 Days': 0,
    '15+ Days': 0
  };

  const performanceMap = {};

  filteredTasks.forEach(t => {
    // Member performance mapping
    t.assignedTo.forEach(u => {
      if (!performanceMap[u.id]) {
        performanceMap[u.id] = {
          name: u.name || 'Unknown',
          avatar: u.profileImageUrl,
          total: 0,
          completed: 0,
          onTime: 0
        };
      }
      performanceMap[u.id].total++;
      if (t.status === 'Completed') {
        performanceMap[u.id].completed++;
      }
    });

    if (t.status === 'Completed') {
      const compTime = completionTimes[t.id] || now;
      const startTime = progressTimes[t.id] || new Date(t.createdAt);
      const diffMs = compTime - startTime;
      const diffDays = Math.max(0, diffMs / 86_400_000);

      totalCycleTime += diffDays;
      cycleTimeCount++;

      if (diffDays <= 1) cycleTimeBuckets['0-1 Day']++;
      else if (diffDays <= 3) cycleTimeBuckets['2-3 Days']++;
      else if (diffDays <= 7) cycleTimeBuckets['4-7 Days']++;
      else if (diffDays <= 14) cycleTimeBuckets['8-14 Days']++;
      else cycleTimeBuckets['15+ Days']++;

      // Check if completed on time
      const isOnTime = !t.dueDate || compTime <= new Date(t.dueDate);
      if (isOnTime) {
        t.assignedTo.forEach(u => {
          if (performanceMap[u.id]) performanceMap[u.id].onTime++;
        });
      }
    }
  });

  const avgCycleTime = cycleTimeCount > 0 ? (totalCycleTime / cycleTimeCount).toFixed(1) : '0.0';

  const cycleTimeData = Object.entries(cycleTimeBuckets).map(([bucket, count]) => ({
    name: bucket,
    count
  }));

  const leaderboard = Object.values(performanceMap).map(p => ({
    ...p,
    onTimeRate: p.completed > 0 ? Math.round((p.onTime / p.completed) * 100) : 0
  })).sort((a, b) => b.completed - a.completed);

  // 7. Workload (Active tasks assigned per member)
  const workloadMap = {};
  tasks.forEach(t => {
    if (t.status === 'Completed') return;
    t.assignedTo.forEach(u => {
      const name = u.name || 'Unknown';
      if (!workloadMap[name]) {
        workloadMap[name] = { name, count: 0, avatar: u.profileImageUrl };
      }
      workloadMap[name].count++;
    });
  });
  const workloadData = Object.values(workloadMap).sort((a, b) => b.count - a.count);

  // 8. Sprints & Velocity
  let sprints = [];
  let velocityData = [];
  try {
    const list = await getSprints(workspaceId);
    sprints = list || [];
    
    // Build velocity stats
    const sprintStats = await Promise.all(
      sprints.map(async (s) => {
        const sTasks = await getSprintTasks(s.id);
        const totalT = sTasks.length;
        const compT = sTasks.filter(t => t.status === 'Completed').length;
        return {
          name: s.name,
          completed: compT,
          total: totalT
        };
      })
    );
    velocityData = sprintStats.reverse(); // Chronological order
  } catch (err) {
    console.error("Velocity fetch error:", err);
  }

  // 9. OKR/Goal progress
  let goalData = [];
  try {
    const { data: goals } = await supabase
      .from('goals')
      .select('id, title, status, progress, deadline:due_date')
      .eq('workspace_id', workspaceId);
    goalData = goals || [];
  } catch (err) {
    console.error("Goals fetch error:", err);
  }

  // 10. Historical Overdue Snapshots (Last 30 days of snapshots)
  let overdueTrend = [];
  try {
    const { data: snapshots } = await supabase
      .from('workspace_analytics_snapshots')
      .select('snapshot_date, overdue, completed, total_tasks')
      .eq('workspace_id', workspaceId)
      .order('snapshot_date', { ascending: true })
      .limit(30);

    overdueTrend = (snapshots || []).map(s => ({
      date: new Date(s.snapshot_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      overdue: s.overdue,
      completed: s.completed,
      total: s.total_tasks
    }));
  } catch (err) {
    console.error("Overdue snapshots fetch error:", err);
  }

  return {
    summary: { total, completed, inProgress, pending, overdue, healthScore, avgCycleTime },
    statusData,
    priorityData,
    trendData,
    workloadData,
    velocityData,
    cycleTimeData,
    leaderboard,
    goalData,
    overdueTrend,
    sprints,
    tasks // raw for exports
  };
};

/**
 * Burndown data for a specific Sprint
 * @param {string} sprintId
 */
export const getSprintBurndownData = async (sprintId) => {
  try {
    const { data: sprint } = await supabase
      .from('sprints')
      .select('*')
      .eq('id', sprintId)
      .single();

    if (!sprint) return [];

    const tasks = await getSprintTasks(sprintId);
    const startDate = new Date(sprint.start_date || sprint.created_at);
    const endDate = new Date(sprint.end_date || Date.now());
    
    const diffMs = endDate - startDate;
    const days = Math.max(1, Math.ceil(diffMs / 86_400_000) + 1);
    
    const totalWork = tasks.length;
    const idealPerDay = totalWork / Math.max(1, days - 1);

    const data = Array.from({ length: days }, (_, i) => {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const dayEnd = new Date(d);
      dayEnd.setHours(23, 59, 59, 999);
      
      const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const ideal = Math.round(Math.max(0, totalWork - idealPerDay * i));
      
      // Calculate remaining tasks on this day
      const remaining = tasks.filter(t => {
        // If task was completed AFTER this day's end, it counts as remaining on this day
        if (t.status === 'Completed') {
          const compDate = new Date(t.updated_at || t.created_at);
          return compDate > dayEnd;
        }
        return true;
      }).length;

      return { date: dateLabel, ideal, actual: remaining };
    });

    return data;
  } catch (err) {
    console.error("Sprint burndown error:", err);
    return [];
  }
};
