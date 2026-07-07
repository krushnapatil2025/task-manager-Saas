import React from "react";
import Progress from "../Progress";
import AvatarGroup from "../AvatarGroup";
import { LuPaperclip } from "react-icons/lu";
import moment from "moment";


const TaskCard = ({
    taskNumber,
    title,
    description,
    priority,
    status,
    progress,
    createdAt,
    dueDate,
    assignedTo,
    attachmentCount,
    completedTodoCount,
    todoChecklist,
    onClick
}) => {

    const getStatusTagColor = () => {
        switch (status) {
            case "Pending":
                return "text-amber-600 bg-amber-50 border border-amber-500/10";
            case "In Progress":
                return "text-cyan-500 bg-cyan-50 border border-cyan-500/10";
            case "Completed":
                return "text-lime-500 bg-lime-50 border border-lime-500/20";
            default:
                return "text-violet-500 bg-violet-50 border border-violet-500/20";
        }
    };

    const getPriorityTagColor = () => {
        switch (priority) {
            case "Low":
                return "text-emerald-500 bg-emerald-50 border border-emerald-500/10";
            case "Medium":
                return "text-amber-500 bg-amber-50 border border-amber-500/10";
            default:
                return "text-rose-500 bg-rose-50 border border-rose-500/10";
        }
    };

    return (
        <div
            className="bg-white/80 backdrop-blur-md rounded-2xl py-5 border border-slate-200/50 hover:border-slate-300/80 cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.015),0_8px_24px_rgba(148,163,184,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.02),0_12px_36px_rgba(148,163,184,0.07)] hover:-translate-y-0.5 transition-all duration-300 flex flex-col gap-4"
            onClick={onClick}
        >
            <div className="flex items-center justify-between px-5">
                <div className="flex gap-2">
                    <div className={`text-[10px] font-bold tracking-wide uppercase ${getStatusTagColor()} px-3 py-1 rounded-full`}>
                        {status}
                    </div>
                    <div className={`text-[10px] font-bold tracking-wide uppercase ${getPriorityTagColor()} px-3 py-1 rounded-full`}>
                        {priority}
                    </div>
                </div>
                {attachmentCount > 0 && (
                    <div className="flex items-center gap-1 text-slate-400 font-semibold text-xs">
                        <LuPaperclip className="text-slate-400 text-sm" />
                        <span>{attachmentCount}</span>
                    </div>
                )}
            </div>

            <div
                className={`px-5 border-l-[3px] ${status === "In Progress"
                    ? "border-cyan-500"
                    : status === "Completed"
                        ? "border-emerald-500"
                        : "border-indigo-500"
                    }`}
            >
                <h4 className="text-sm font-bold text-slate-800 line-clamp-1 leading-snug flex items-center gap-1.5">
                    {taskNumber && (
                        <span className="text-[10px] bg-slate-100 border border-slate-200 text-slate-655 px-1.5 py-0.5 rounded font-mono font-bold dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300">
                            {taskNumber}
                        </span>
                    )}
                    {title}
                </h4>
                <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-[18px] font-medium">
                    {description}
                </p>
                
                {todoChecklist && todoChecklist.length > 0 && (
                    <div className="mt-3.5 mb-2">
                        <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5">
                            <span>Todos Progress</span>
                            <span>{completedTodoCount} / {todoChecklist.length}</span>
                        </div>
                        <Progress progress={progress} status={status} />
                    </div>
                )}
            </div>

            <div className="px-5 border-t border-slate-100/80 pt-4 flex flex-col gap-3.5 mt-auto">
                <div className="flex items-center justify-between">
                    <div>
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Start Date</label>
                        <p className="text-xs font-bold text-slate-700 mt-0.5">
                            {moment(createdAt).format("Do MMM YYYY")}
                        </p>
                    </div>
                    <div className="text-right">
                        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Due Date</label>
                        <p className="text-xs font-bold text-slate-700 mt-0.5">
                            {moment(dueDate).format("Do MMM YYYY")}
                        </p>
                    </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-50 pt-3">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Assignees</span>
                    <AvatarGroup avatars={assignedTo || []} />
                </div>
            </div>
        </div>
    );
}
export default React.memo(TaskCard);