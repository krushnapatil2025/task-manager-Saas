import React from 'react';
import { LuClipboardCheck } from 'react-icons/lu';

export const TaskLinker = ({ tasks = [], selectedTaskId, onChange }) => {
  return (
    <div className="relative">
      <select
        value={selectedTaskId || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xs font-bold text-slate-700 appearance-none bg-white"
      >
        <option value="">No linked task</option>
        {tasks.map((task) => (
          <option key={task.id} value={task.id}>
            {task.title} ({task.status})
          </option>
        ))}
      </select>
      <LuClipboardCheck className="absolute left-3.5 top-3.5 text-slate-400" size={14} />
    </div>
  );
};

export default TaskLinker;
