import React from 'react'
import moment from 'moment';

const TaskListTable = ({ tableData }) => {
    const getStatusBadgeColor = (status) => {
        switch (status) {
            case 'Completed': return 'bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30 font-semibold text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider';
            case 'Pending': return 'bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30 font-semibold text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider';
            case 'In Progress': return 'bg-cyan-50 text-cyan-700 border border-cyan-100 dark:bg-cyan-950/20 dark:text-cyan-400 dark:border-cyan-900/30 font-semibold text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider';
            default: return 'bg-slate-50 text-slate-600 border border-slate-200 dark:bg-zinc-800/40 dark:text-zinc-400 dark:border-zinc-700 font-semibold text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider';
        }
    };

    const getPriorityBadgeColor = (priority) => {
        switch (priority?.toLowerCase()) {
            case 'high': return 'bg-rose-50 text-rose-700 border border-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30 font-semibold text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider';
            case 'medium': return 'bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30 font-semibold text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider';
            case 'low': return 'bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30 font-semibold text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider';
            default: return 'bg-slate-50 text-slate-600 border border-slate-200 dark:bg-zinc-800/40 dark:text-zinc-400 dark:border-zinc-700 font-semibold text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider';
        }
    };

    return (
        <div className='overflow-x-auto p-0 rounded-xl mt-4 border border-slate-100 dark:border-zinc-800'>
            <table className='premium-table min-w-full'>
                <thead>
                    <tr>
                        <th className="dark:text-zinc-500">Task Name</th>
                        <th className="dark:text-zinc-500">Status</th>
                        <th className="dark:text-zinc-500">Priority</th>
                        <th className="hidden md:table-cell dark:text-zinc-500">Created On</th>
                    </tr>
                </thead>
                <tbody>
                    {tableData.map((task) => (
                        <tr key={task.id || task._id} className="dark:border-zinc-800 hover:dark:bg-zinc-900/30">
                            <td className="font-bold text-slate-805 dark:text-zinc-150 py-3.5">
                                <div className="flex items-center gap-1.5 min-w-0">
                                    {task.taskNumber && (
                                        <span className="text-[10px] bg-slate-100 border border-slate-200 text-slate-655 px-1.5 py-0.5 rounded font-mono font-bold dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 flex-shrink-0">
                                            {task.taskNumber}
                                        </span>
                                    )}
                                    <div className="line-clamp-1 max-w-[280px] truncate">
                                        {task.title}
                                    </div>
                                </div>
                            </td>
                            <td>
                                <span className={`inline-flex ${getStatusBadgeColor(task.status)}`}>
                                    {task.status}
                                </span>
                            </td>
                            <td>
                                <span className={`inline-flex ${getPriorityBadgeColor(task.priority)}`}>
                                    {task.priority}
                                </span>
                            </td>
                            <td className='text-slate-400 dark:text-zinc-500 font-semibold text-xs hidden md:table-cell'>
                                {task.createdAt ? moment(task.createdAt).format('Do MMM YYYY') : 'N/A'}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

export default TaskListTable