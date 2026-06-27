import React from 'react';

const GoalProgressRing = ({ progress = 0, size = 120, strokeWidth = 10, title = "" }) => {
  const cleanProgress = Math.min(Math.max(0, progress), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (cleanProgress / 100) * circumference;

  // Determine progress color gradient / classes
  const getStrokeColor = () => {
    if (cleanProgress < 30) return "stroke-rose-500 dark:stroke-rose-400";
    if (cleanProgress < 75) return "stroke-amber-500 dark:stroke-amber-400";
    return "stroke-indigo-500 dark:stroke-indigo-400";
  };

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative" style={{ width: size, height: size }}>
        {/* SVG Circle */}
        <svg className="w-full h-full transform -rotate-90" viewBox={`0 0 ${size} ${size}`}>
          {/* Background track */}
          <circle
            className="stroke-slate-100 dark:stroke-slate-800"
            fill="transparent"
            strokeWidth={strokeWidth}
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
          {/* Active progress */}
          <circle
            className={`transition-all duration-700 ease-out ${getStrokeColor()}`}
            fill="transparent"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
        </svg>
        
        {/* Inner Label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
            {Math.round(cleanProgress)}%
          </span>
          {title && (
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider px-2 truncate max-w-full">
              {title}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default GoalProgressRing;
