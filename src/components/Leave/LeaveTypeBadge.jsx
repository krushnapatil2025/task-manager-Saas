import React from 'react';

const LeaveTypeBadge = ({ leaveType }) => {
  if (!leaveType) return null;
  const { name, color, code } = leaveType;

  // Derive light/dark color styles from hex
  const baseColor = color || '#6366F1';

  return (
    <span 
      className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider border"
      style={{
        backgroundColor: `${baseColor}12`,
        color: baseColor,
        borderColor: `${baseColor}30`
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: baseColor }} />
      <span className="font-semibold">{name}</span>
      <span className="text-[8px] opacity-60 font-normal">({code})</span>
    </span>
  );
};

export default LeaveTypeBadge;
