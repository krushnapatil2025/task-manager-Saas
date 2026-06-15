import React from 'react';
import usePermissions from '../hooks/usePermissions';

// ─────────────────────────────────────────────────────────────────────────────
// PermissionGate
// Conditionally renders children only when the user has the required permission.
//
// Props:
//   permission  {string}       e.g. "canCreateTask" or "createTask"
//   fallback    {ReactNode}    Optional UI to show when permission is denied
//                              (if omitted, renders nothing)
//   tooltip     {string}       Optional tooltip on the fallback element
//
// Usage:
//   <PermissionGate permission="canCreateTask">
//     <button>Create Task</button>
//   </PermissionGate>
//
//   <PermissionGate permission="canDeleteTask" fallback={<DisabledBtn/>}>
//     <DeleteButton />
//   </PermissionGate>
// ─────────────────────────────────────────────────────────────────────────────
const PermissionGate = ({ permission, children, fallback = null, tooltip }) => {
  const perms = usePermissions();

  // Normalise key: accept both "canCreateTask" and "createTask"
  const key = permission.startsWith('can')
    ? permission
    : 'can' + permission.charAt(0).toUpperCase() + permission.slice(1);

  const allowed = perms[key] === true;

  if (allowed) return <>{children}</>;

  if (fallback) {
    return tooltip
      ? <span title={tooltip} className="inline-flex cursor-not-allowed opacity-50">{fallback}</span>
      : <>{fallback}</>;
  }

  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Convenience: DisabledButton — shows a greyed, non-clickable button
// ─────────────────────────────────────────────────────────────────────────────
export const DisabledButton = ({ children, className = '', title }) => (
  <button
    disabled
    title={title || 'You do not have permission for this action'}
    className={`opacity-40 cursor-not-allowed ${className}`}
  >
    {children}
  </button>
);

// ─────────────────────────────────────────────────────────────────────────────
// PermissionBadge — shows a small "🔒 No access" label
// Used for inline explanations in admin UI
// ─────────────────────────────────────────────────────────────────────────────
export const PermissionBadge = ({ label = 'Restricted' }) => (
  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-400 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
    🔒 {label}
  </span>
);

export default PermissionGate;
