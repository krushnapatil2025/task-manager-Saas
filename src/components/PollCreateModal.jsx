import React, { useState } from 'react';
import { LuX, LuPlus, LuTrash2, LuChartPie } from 'react-icons/lu';
import { toast } from 'react-hot-toast';

export const PollCreateModal = ({ onSubmit, onClose }) => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);

  const handleAddOption = () => {
    if (options.length >= 10) {
      toast.error('Maximum 10 options allowed');
      return;
    }
    setOptions([...options, '']);
  };

  const handleRemoveOption = (index) => {
    if (options.length <= 2) {
      toast.error('Minimum 2 options required');
      return;
    }
    setOptions(options.filter((_, idx) => idx !== index));
  };

  const handleOptionChange = (index, value) => {
    const nextOptions = [...options];
    nextOptions[index] = value;
    setOptions(nextOptions);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!question.trim()) {
      toast.error('Please enter a question');
      return;
    }

    const filteredOptions = options.map(opt => opt.trim()).filter(Boolean);
    if (filteredOptions.length < 2) {
      toast.error('Please provide at least 2 non-empty options');
      return;
    }

    // Initialize votes object: keys are options, values are empty arrays of user IDs
    const votes = {};
    filteredOptions.forEach(opt => {
      votes[opt] = [];
    });

    const pollData = {
      question: question.trim(),
      options: filteredOptions,
      votes,
    };

    onSubmit(JSON.stringify(pollData));
  };

  return (
    <div className="modal-overlay flex items-center justify-center p-4">
      <div className="modal-card max-w-md w-full animate-fade-in bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-zinc-900">
          <div className="flex items-center gap-2">
            <LuChartPie className="text-indigo-600" size={18} />
            <h3 className="font-bold text-sm text-slate-800 dark:text-zinc-100">Create a Poll</h3>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 hover:bg-slate-100 dark:hover:bg-zinc-900 rounded-lg text-slate-400 dark:text-zinc-500 transition-colors"
          >
            <LuX size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4">
          {/* Question */}
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 block mb-1.5">
              Question
            </label>
            <input
              type="text"
              placeholder="e.g., Which day works best for our weekly sync?"
              className="w-full text-xs px-3.5 py-2.5 border border-slate-200 dark:border-zinc-800 rounded-xl bg-slate-50/50 dark:bg-zinc-900 outline-none focus:border-indigo-500 text-slate-800 dark:text-zinc-150"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              maxLength={200}
              required
            />
          </div>

          {/* Options */}
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 block mb-1.5">
              Options
            </label>
            <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
              {options.map((option, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder={`Option ${idx + 1}`}
                    className="flex-1 text-xs px-3.5 py-2 border border-slate-200 dark:border-zinc-800 rounded-xl bg-slate-50/50 dark:bg-zinc-900 outline-none focus:border-indigo-500 text-slate-800 dark:text-zinc-150"
                    value={option}
                    onChange={e => handleOptionChange(idx, e.target.value)}
                    maxLength={100}
                    required
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(idx)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-colors"
                      title="Remove option"
                    >
                      <LuTrash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {options.length < 10 && (
              <button
                type="button"
                onClick={handleAddOption}
                className="mt-3 flex items-center gap-1.5 text-xs text-indigo-650 hover:text-indigo-850 font-bold transition-colors"
              >
                <LuPlus size={13} />
                <span>Add option</span>
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="mt-2 border-t border-slate-105 dark:border-zinc-900 pt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-900 px-3.5 py-2 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="text-xs bg-indigo-650 hover:bg-indigo-750 text-white px-5 py-2 rounded-xl font-bold transition-colors shadow-sm cursor-pointer"
            >
              Create Poll
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PollCreateModal;
