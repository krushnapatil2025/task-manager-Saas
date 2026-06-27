import React, { useState } from 'react';
import { LuPlus, LuTrash2 } from 'react-icons/lu';

const TodoListInput = ({ todoList = [], setTodoList }) => {
    const [subtaskTitle, setSubtaskTitle] = useState('');
    const [subtaskDesc, setSubtaskDesc] = useState('');

    // Function to handle adding a subtask
    const handleAddOption = () => {
        if (subtaskTitle.trim()) {
            const newItem = {
                title: subtaskTitle.trim(),
                description: subtaskDesc.trim(),
                completed: false
            };
            setTodoList([...(todoList || []), newItem]);
            setSubtaskTitle('');
            setSubtaskDesc('');
        }
    };

    // Function to handle deleting a subtask
    const handleDeleteOption = (index) => {
        const updatedArr = (todoList || []).filter((_, idx) => idx !== index);
        setTodoList(updatedArr);
    };

    return (
        <div className="space-y-4">
            {/* List of subtasks */}
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {(todoList || []).map((item, index) => {
                    const title = typeof item === 'string' ? item : item.title;
                    const description = typeof item === 'string' ? '' : item.description;
                    const completed = typeof item === 'string' ? false : item.completed;
                    
                    return (
                        <div
                            key={index}
                            className="flex items-start justify-between bg-slate-50/50 border border-slate-100 hover:border-slate-200/80 px-4 py-3 rounded-xl transition duration-150"
                        >
                            <div className="flex-1 min-w-0 pr-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
                                        Subtask {index < 9 ? `0${index + 1}` : index + 1}
                                    </span>
                                    {completed && (
                                        <span className="text-[9px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wider">
                                            Completed
                                        </span>
                                    )}
                                </div>
                                <h4 className={`text-xs font-bold mt-1 text-slate-800 ${completed ? 'line-through text-slate-400' : ''}`}>
                                    {title}
                                </h4>
                                {description && (
                                    <p className="text-[11px] text-slate-500 font-medium mt-1 bg-white/60 border border-slate-100 rounded-lg p-2 leading-relaxed">
                                        {description}
                                    </p>
                                )}
                            </div>
                            <button
                                type="button"
                                className="text-slate-400 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-lg transition duration-150 cursor-pointer"
                                onClick={() => handleDeleteOption(index)}
                                title="Remove Subtask"
                            >
                                <LuTrash2 size={14} />
                            </button>
                        </div>
                    );
                })}
                {(todoList || []).length === 0 && (
                    <p className="text-[11px] text-slate-400 italic py-1">No subtasks added yet.</p>
                )}
            </div>

            {/* Input Form for new subtask */}
            <div className="bg-slate-50/30 border border-slate-200/50 rounded-xl p-4 space-y-3 mt-3">
                <div>
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
                        Subtask Name
                    </label>
                    <input
                        type="text"
                        placeholder="e.g. Set up database indices"
                        value={subtaskTitle}
                        onChange={({ target }) => setSubtaskTitle(target.value)}
                        className="w-full px-3 py-2 text-xs font-bold text-slate-700 placeholder-slate-350 bg-white rounded-lg border border-slate-200 outline-none focus:border-indigo-500 transition-all"
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
                        Subtask Description (Optional)
                    </label>
                    <textarea
                        placeholder="e.g. Add indexes on workspace_id and created_at fields"
                        value={subtaskDesc}
                        onChange={({ target }) => setSubtaskDesc(target.value)}
                        rows={2}
                        className="w-full px-3 py-2 text-xs font-semibold text-slate-700 placeholder-slate-350 bg-white rounded-lg border border-slate-200 outline-none focus:border-indigo-500 transition-all resize-none"
                    />
                </div>
                <div className="flex justify-end pt-1">
                    <button
                        type="button"
                        onClick={handleAddOption}
                        className="flex items-center gap-1.5 text-[10px] font-extrabold text-white bg-indigo-650 hover:bg-indigo-750 px-4 py-2 rounded-lg transition cursor-pointer shadow-sm shadow-indigo-100"
                    >
                        <LuPlus size={12} /> Add Subtask
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TodoListInput;
