import { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { UserContext }      from '../context/userContext';
import { WorkspaceContext } from '../context/WorkspaceContext';
import {
  startTimer, stopTimer, getActiveTimer,
  getTaskTimeLogs, getTaskTotalTime, formatElapsed,
} from '../services/timeTrackingService';

// ─────────────────────────────────────────────────────────────────────────────
// useTimer — manages a start/stop timer for a single task
//
// Returns:
//   running     boolean  — timer is active
//   elapsed     number   — current session elapsed seconds (live tick)
//   totalSec    number   — all completed sessions total
//   logs        array    — completed sessions for this task
//   loading     boolean
//   error       string | null
//   start()     async
//   stop()      async
//   refresh()   async
// ─────────────────────────────────────────────────────────────────────────────

const useTimer = (taskId) => {
  const { user }      = useContext(UserContext);
  const { workspace } = useContext(WorkspaceContext);

  const [running,    setRunning  ] = useState(false);
  const [elapsed,    setElapsed  ] = useState(0);   // seconds for live display
  const [totalSec,   setTotalSec ] = useState(0);
  const [logs,       setLogs     ] = useState([]);
  const [loading,    setLoading  ] = useState(false);
  const [error,      setError    ] = useState(null);

  const activeLogId   = useRef(null);
  const startedAtRef  = useRef(null);
  const tickInterval  = useRef(null);

  // ── Tick every second when running ────────────────────────────────────────
  const startTick = useCallback((startedAt) => {
    startedAtRef.current = startedAt;
    setElapsed(Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
    tickInterval.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
    }, 1000);
  }, []);

  const stopTick = useCallback(() => {
    clearInterval(tickInterval.current);
    tickInterval.current = null;
    setElapsed(0);
    startedAtRef.current = null;
  }, []);

  // ── Load initial state ─────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    if (!taskId || !user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [active, total, taskLogs] = await Promise.all([
        getActiveTimer(user.id, taskId),
        getTaskTotalTime(taskId),
        getTaskTimeLogs(taskId),
      ]);

      setTotalSec(total || 0);
      setLogs(taskLogs || []);

      if (active) {
        activeLogId.current = active.id;
        setRunning(true);
        startTick(active.started_at);
      } else {
        activeLogId.current = null;
        setRunning(false);
        stopTick();
      }
    } catch (err) {
      setError(err.message || 'Timer error');
    } finally {
      setLoading(false);
    }
  }, [taskId, user?.id, startTick, stopTick]);

  useEffect(() => {
    refresh();
    return () => stopTick();
  }, [refresh]);

  // ── Start timer ───────────────────────────────────────────────────────────
  const start = useCallback(async () => {
    if (running || !taskId || !user?.id || !workspace?.id) return;
    setLoading(true);
    try {
      const log = await startTimer(taskId, workspace.id, user.id);
      activeLogId.current = log.id;
      setRunning(true);
      startTick(log.started_at);
    } catch (err) {
      setError(err.message || 'Failed to start timer');
    } finally {
      setLoading(false);
    }
  }, [running, taskId, user?.id, workspace?.id, startTick]);

  // ── Stop timer ────────────────────────────────────────────────────────────
  const stop = useCallback(async () => {
    if (!running || !activeLogId.current) return;
    setLoading(true);
    try {
      const log = await stopTimer(activeLogId.current);
      setTotalSec(prev => prev + (log.duration_sec || 0));
      setLogs(prev => [{ ...log }, ...prev]);
      activeLogId.current = null;
      setRunning(false);
      stopTick();
    } catch (err) {
      setError(err.message || 'Failed to stop timer');
    } finally {
      setLoading(false);
    }
  }, [running, stopTick]);

  return {
    running,
    elapsed,
    elapsedDisplay: formatElapsed(elapsed),
    totalSec,
    logs,
    loading,
    error,
    start,
    stop,
    refresh,
  };
};

export default useTimer;
