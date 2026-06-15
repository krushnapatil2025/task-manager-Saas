import React from 'react'
import moment from 'moment';
const TaskListTable = ({ tableData }) => {
    const getStatusBadgeColor = (status) => {
        switch (status) {
            case 'Completed': return 'bg-emerald-50 text-emerald-600 border border-emerald-100 font-semibold text-[11px] px-2.5 py-0.5 rounded-full';
            case 'Pending': return 'bg-violet-50 text-violet-600 border border-violet-100 font-semibold text-[11px] px-2.5 py-0.5 rounded-full';
            case 'In Progress': return 'bg-cyan-50 text-cyan-600 border border-cyan-100 font-semibold text-[11px] px-2.5 py-0.5 rounded-full';
            default: return 'bg-slate-50 text-slate-500 border border-slate-200 font-semibold text-[11px] px-2.5 py-0.5 rounded-full';
        }
    };

    const getPriorityBadgeColor = (priority) => {
        switch (priority?.toLowerCase()) {
            case 'high': return 'bg-rose-50 text-rose-600 border border-rose-100 font-semibold text-[11px] px-2.5 py-0.5 rounded-full';
            case 'medium': return 'bg-amber-50 text-amber-600 border border-amber-100 font-semibold text-[11px] px-2.5 py-0.5 rounded-full';
            case 'low': return 'bg-emerald-50 text-emerald-600 border border-emerald-100 font-semibold text-[11px] px-2.5 py-0.5 rounded-full';
            default: return 'bg-slate-50 text-slate-500 border border-slate-200 font-semibold text-[11px] px-2.5 py-0.5 rounded-full';
        }
    };

    return (
        <div className='overflow-x-auto p-0 rounded-2xl mt-4 border border-slate-100'>
            <table className='premium-table min-w-full'>
                <thead>
                    <tr>
                        <th>Task Name</th>
                        <th>Status</th>
                        <th>Priority</th>
                        <th className="hidden md:table-cell">Created On</th>
                    </tr>
                </thead>
                <tbody>
                    {tableData.map((task) => (
                        <tr key={task.id || task._id}>
                            <td className="font-bold text-slate-800">
                                <div className="line-clamp-1 max-w-[280px]">
                                    {task.title}
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
                            <td className='text-slate-400 font-semibold text-xs hidden md:table-cell'>
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