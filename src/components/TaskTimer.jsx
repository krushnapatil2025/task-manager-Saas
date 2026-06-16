import React, { useState } from 'react';
import {
  LuPlay, LuSquare, LuClock, LuLoaderCircle,
  LuChevronDown, LuChevronUp, LuTrash2,
} from 'react-icons/lu';
import useTimer from '../hooks/useTimer';
import { formatDuration, deleteTimeLog } from '../services/timeTrackingService';
import moment from 'moment';

// ─────────────────────────────────────────────────────────────────────────────
// TaskTimer — Start/Stop widget embedded in ViewTaskDetails
//
// Props:
//   taskId   string
// ─────────────────────────────────────────────────────────────────────────────

const TaskTimer = ({ taskId }) => {
  const {
    running, elapsed, elapsedDisplay,
    totalSec, logs, loading, error,
    start, stop, refresh,
  } = useTimer(taskId);

  const [showLogs, setShowLogs] = useState(false);

  const handleDelete = async (logId) => {
    try {
      await deleteTimeLog(logId);
      await refresh();
    } catch (err) {
      console.error('Failed to delete log:', err);
    }
  };

  return (
    <div className="task-timer-wrap">
      {/* ── Header row ── */}
      <div className="task-timer-header">
        <div className="task-timer-icon-wrap">
          <LuClock size={13} />
        </div>
        <span className="task-timer-title">Time Tracker</span>
        {totalSec > 0 && (
          <span className="task-timer-total">
            {formatDuration(totalSec)} logged
          </span>
        )}
      </div>

      {/* ── Live display ── */}
      <div className="task-timer-display">
        <span className={`task-timer-clock ${running ? 'task-timer-clock--running' : ''}`}>
          {running ? elapsedDisplay : formatDuration(totalSec) || '00:00:00'}
        </span>
        {running && (
          <span className="task-timer-live-dot" />
        )}
      </div>

      {/* ── Controls ── */}
      <div className="task-timer-controls">
        {!running ? (
          <button
            id="timer-start"
            className="task-timer-btn task-timer-btn--start"
            onClick={start}
            disabled={loading}
            title="Start tracking time"
          >
            {loading
              ? <LuLoaderCircle size={14} className="ai-spin" />
              : <LuPlay size={14} />}
            Start Timer
          </button>
        ) : (
          <button
            id="timer-stop"
            className="task-timer-btn task-timer-btn--stop"
            onClick={stop}
            disabled={loading}
            title="Stop timer and log time"
          >
            {loading
              ? <LuLoaderCircle size={14} className="ai-spin" />
              : <LuSquare size={14} />}
            Stop & Log
          </button>
        )}

        {logs.length > 0 && (
          <button
            className="task-timer-btn task-timer-btn--ghost"
            onClick={() => setShowLogs(v => !v)}
          >
            {showLogs ? <LuChevronUp size={13} /> : <LuChevronDown size={13} />}
            {logs.length} session{logs.length !== 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* ── Error ── */}
      {error && <p className="task-timer-error">{error}</p>}

      {/* ── Session log list ── */}
      {showLogs && logs.length > 0 && (
        <div className="task-timer-logs">
          {logs.map(log => (
            <div key={log.id} className="task-timer-log-row">
              <div className="task-timer-log-meta">
                <span className="task-timer-log-duration">
                  {formatDuration(log.durationSec)}
                </span>
                <span className="task-timer-log-date">
                  {moment(log.startedAt).format('MMM D, h:mm A')}
                </span>
              </div>
              <button
                className="task-timer-log-del"
                onClick={() => handleDelete(log.id)}
                title="Delete this session"
              >
                <LuTrash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TaskTimer;
