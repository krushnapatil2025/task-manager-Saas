import React from 'react';
import { LuCheck, LuUsers } from 'react-icons/lu';
import { toast } from 'react-hot-toast';

export const PollMessage = ({ message, userId, onVote }) => {
  let pollData;
  try {
    pollData = typeof message.content === 'string' ? JSON.parse(message.content) : message.content;
  } catch (err) {
    console.error('Failed to parse poll JSON:', err);
    return <div className="text-xs text-red-500 italic p-2 bg-red-50 rounded-lg">Malformed poll data</div>;
  }

  const { question, options = [], votes = {} } = pollData;

  // Calculate totals
  const optionVoteCounts = {};
  let totalVotes = 0;

  options.forEach(opt => {
    const list = votes[opt] || [];
    optionVoteCounts[opt] = list.length;
    totalVotes += list.length;
  });

  const handleVote = async (option) => {
    if (!userId) {
      toast.error('You must be logged in to vote');
      return;
    }

    // Toggle vote (single choice poll)
    const nextVotes = { ...votes };

    options.forEach(opt => {
      if (!nextVotes[opt]) nextVotes[opt] = [];
      
      const hasVoted = nextVotes[opt].includes(userId);
      if (opt === option) {
        if (hasVoted) {
          // Remove vote
          nextVotes[opt] = nextVotes[opt].filter(id => id !== userId);
        } else {
          // Add vote
          nextVotes[opt] = [...nextVotes[opt], userId];
        }
      } else {
        // Remove vote from other options (single choice constraint)
        nextVotes[opt] = nextVotes[opt].filter(id => id !== userId);
      }
    });

    const updatedPoll = {
      ...pollData,
      votes: nextVotes
    };

    try {
      await onVote(JSON.stringify(updatedPoll));
    } catch (err) {
      console.error('Failed to register vote:', err);
      toast.error('Failed to save vote');
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm w-full max-w-sm my-1.5 transition-all hover:shadow-md">
      {/* Question */}
      <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-100 mb-3 leading-snug">
        {question}
      </h4>

      {/* Options List */}
      <div className="flex flex-col gap-2.5">
        {options.map((option, idx) => {
          const voteList = votes[option] || [];
          const count = voteList.length;
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const isMyVote = voteList.includes(userId);

          return (
            <button
              key={idx}
              onClick={() => handleVote(option)}
              className="group relative w-full text-left p-2.5 rounded-xl border border-slate-150 dark:border-zinc-800 overflow-hidden transition-all hover:border-indigo-400 bg-slate-50/30 dark:bg-zinc-950/20 flex items-center justify-between gap-3"
            >
              {/* Progress fill */}
              <div 
                className="absolute left-0 top-0 bottom-0 bg-indigo-500/10 dark:indigo-500/20 transition-all duration-500 z-0" 
                style={{ width: `${pct}%` }}
              />

              {/* Text option */}
              <div className="flex items-center gap-2 z-10 min-w-0">
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors ${
                  isMyVote 
                    ? 'bg-indigo-600 border-indigo-650 text-white' 
                    : 'border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900'
                }`}>
                  {isMyVote && <LuCheck size={10} strokeWidth={3} />}
                </div>
                <span className={`text-[11.5px] truncate ${isMyVote ? 'font-semibold text-indigo-700 dark:text-indigo-400' : 'text-slate-700 dark:text-zinc-300'}`}>
                  {option}
                </span>
              </div>

              {/* Vote Count & Percent */}
              <div className="flex items-center gap-1.5 z-10 text-[10px] text-slate-400 dark:text-zinc-500 font-medium">
                <span>{count} vote{count !== 1 ? 's' : ''}</span>
                <span className="text-slate-300 dark:text-zinc-700">•</span>
                <span className={isMyVote ? 'font-bold text-indigo-600 dark:text-indigo-400' : ''}>{pct}%</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="mt-3.5 pt-2.5 border-t border-slate-100 dark:border-zinc-900 flex items-center justify-between text-[9px] text-slate-400 dark:text-zinc-500">
        <div className="flex items-center gap-1">
          <LuUsers size={10} />
          <span>{totalVotes} total vote{totalVotes !== 1 ? 's' : ''}</span>
        </div>
        <span className="italic font-medium">Click an option to vote</span>
      </div>
    </div>
  );
};

export default PollMessage;
