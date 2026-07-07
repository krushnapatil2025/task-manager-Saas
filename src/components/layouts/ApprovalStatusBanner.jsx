import React, { useContext, useState, useCallback, useEffect } from 'react';
import { UserContext } from '../../context/userContext';
import {
  LuClock, LuShieldX, LuBan, LuMail, LuBuilding2,
  LuTriangleAlert, LuCircleAlert, LuInfo, LuRefreshCw,
  LuCircleCheck, LuPhone, LuUser, LuBriefcase, LuChevronDown, LuChevronUp,
  LuLock,
} from 'react-icons/lu';

// ─────────────────────────────────────────────────────────────────────────────
// ApprovalStatusBanner — Premium status banner for unapproved company admins.
//
// Source of truth: user.account_approval_status (profiles column — NOT workspace)
//
//  pending    → Yellow/Amber  — under review, waiting for SA decision
//  rejected   → Red           — registration declined
//  restricted → Deep Red      — account suspended
//
// Shows full detail: company info, status steps, reason note, refresh button.
// ─────────────────────────────────────────────────────────────────────────────

const CONFIGS = {
  pending: {
    // Visual theme
    outerBg:    'bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50 dark:from-amber-950/40 dark:via-amber-900/20 dark:to-amber-950/40',
    borderTop:  'border-t-4 border-t-amber-400 dark:border-t-amber-500',
    borderBot:  'border-b border-b-amber-200 dark:border-b-amber-800/50',
    glowBar:    'bg-amber-400',
    headerBg:   'bg-amber-100/80 dark:bg-amber-900/30',
    iconRing:   'bg-amber-200 dark:bg-amber-800/60 ring-4 ring-amber-100 dark:ring-amber-900/40',
    iconColor:  'text-amber-600 dark:text-amber-400',
    Icon:       LuClock,
    badgeBg:    'bg-amber-400 dark:bg-amber-600',
    badgeText:  'text-white',
    badgeLabel: '⏳ PENDING REVIEW',
    titleColor: 'text-amber-900 dark:text-amber-200',
    subColor:   'text-amber-700 dark:text-amber-400',
    noteColor:  'text-amber-800 dark:text-amber-300',
    noteBg:     'bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700',
    stepDot:    'bg-amber-400 dark:bg-amber-500',
    stepText:   'text-amber-800 dark:text-amber-300',
    infoIcon:   LuInfo,
    divider:    'border-amber-200 dark:border-amber-800/50',
    linkColor:  'text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100',
    pulse:      true,

    // Content
    title:   '⏳ Registration Under Review — All Features Locked',
    summary: (company) =>
      `Your company registration for ${company} has been received and is currently awaiting review by our platform administrators. Until your account is approved, all features remain locked.`,
    reasonLabel: 'Administrator Note',
    steps: [
      { icon: '🔍', text: 'Our team is actively verifying your company registration and submitted details' },
      { icon: '📧', text: 'You will receive an email notification the moment a decision is made' },
      { icon: '⏱️', text: 'Typical review time is 1–2 business days from submission' },
      { icon: '✅', text: 'Once approved, all platform features will be instantly unlocked' },
    ],
    noActionText: 'No action is required from you at this time. Our team will reach out if additional information is needed.',
  },

  rejected: {
    outerBg:    'bg-gradient-to-r from-red-50 via-rose-50 to-red-50 dark:from-red-950/50 dark:via-red-900/20 dark:to-red-950/50',
    borderTop:  'border-t-4 border-t-red-500 dark:border-t-red-600',
    borderBot:  'border-b border-b-red-200 dark:border-b-red-800/50',
    glowBar:    'bg-red-500',
    headerBg:   'bg-red-100/80 dark:bg-red-900/30',
    iconRing:   'bg-red-200 dark:bg-red-800/60 ring-4 ring-red-100 dark:ring-red-900/40',
    iconColor:  'text-red-600 dark:text-red-400',
    Icon:       LuShieldX,
    badgeBg:    'bg-red-600 dark:bg-red-700',
    badgeText:  'text-white',
    badgeLabel: '✕ APPLICATION REJECTED',
    titleColor: 'text-red-900 dark:text-red-200',
    subColor:   'text-red-700 dark:text-red-400',
    noteColor:  'text-red-800 dark:text-red-200',
    noteBg:     'bg-red-100 dark:bg-red-900/50 border-red-300 dark:border-red-700',
    stepDot:    'bg-red-500 dark:bg-red-600',
    stepText:   'text-red-800 dark:text-red-300',
    infoIcon:   LuCircleAlert,
    divider:    'border-red-200 dark:border-red-800/50',
    linkColor:  'text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-100',
    pulse:      false,

    title:   '✕ Registration Rejected — Access Denied',
    summary: (company) =>
      `Your registration application for ${company} has been reviewed and unfortunately rejected by our platform administrators. All features are inaccessible. Please review the reason below and contact our support team.`,
    reasonLabel: 'Reason for Rejection',
    steps: [
      { icon: '📋', text: 'Review the rejection reason provided by our administrators below' },
      { icon: '📞', text: 'Contact our support team to understand the full decision and next steps' },
      { icon: '🔁', text: 'After resolving the cited issues, you may submit a new registration request' },
      { icon: '📧', text: 'Email support@strideo.app with your company name to discuss reapplication' },
    ],
    noActionText: null,
  },

  restricted: {
    outerBg:    'bg-gradient-to-r from-red-50 via-rose-50 to-red-50 dark:from-rose-950/60 dark:via-red-900/30 dark:to-rose-950/60',
    borderTop:  'border-t-4 border-t-red-700 dark:border-t-red-700',
    borderBot:  'border-b border-b-red-300 dark:border-b-red-800/50',
    glowBar:    'bg-red-700',
    headerBg:   'bg-red-100/80 dark:bg-red-900/40',
    iconRing:   'bg-red-200 dark:bg-red-800/70 ring-4 ring-red-100 dark:ring-red-900/50',
    iconColor:  'text-red-700 dark:text-red-400',
    Icon:       LuBan,
    badgeBg:    'bg-red-800 dark:bg-red-900 border border-red-700',
    badgeText:  'text-white',
    badgeLabel: '⛔ ACCOUNT RESTRICTED',
    titleColor: 'text-red-900 dark:text-red-200',
    subColor:   'text-red-700 dark:text-red-400',
    noteColor:  'text-red-800 dark:text-red-200',
    noteBg:     'bg-red-100 dark:bg-red-900/60 border-red-400 dark:border-red-700',
    stepDot:    'bg-red-700 dark:bg-red-700',
    stepText:   'text-red-800 dark:text-red-300',
    infoIcon:   LuCircleAlert,
    divider:    'border-red-200 dark:border-red-800/50',
    linkColor:  'text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-100',
    pulse:      false,

    title:   '⛔ Account Restricted — All Access Suspended',
    summary: (company) =>
      `Your company account for ${company} has been restricted by our platform administrators. All data access, features, and operations have been immediately suspended. This requires urgent attention.`,
    reasonLabel: 'Reason for Restriction',
    steps: [
      { icon: '🔒', text: 'All platform features, data, and operations are currently suspended' },
      { icon: '🚨', text: 'Contact our support team immediately to resolve this restriction' },
      { icon: '📋', text: 'Review the restriction reason stated below and prepare documentation' },
      { icon: '📧', text: 'Email support@strideo.app marked URGENT with your company name' },
    ],
    noActionText: null,
  },
};

const POLL_INTERVAL_MS = 30_000;

const ApprovalStatusBanner = () => {
  const { user, updateUser } = useContext(UserContext);
  const [expanded,   setExpanded]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastChecked, setLastChecked] = useState(null);

  // Only show for company admins with a non-approved profile status
  const isAdmin =
    user?.role === 'admin' ||
    user?.job_profile === 'company_admin' ||
    user?.role === 'company_admin';

  const status = user?.account_approval_status;
  const show   = isAdmin && status && status !== 'approved';

  // Auto-poll every 30s to detect SA approval (silently refreshes profile)
  const checkStatus = useCallback(async (isManual = false) => {
    if (!show) return;
    if (isManual) setRefreshing(true);
    try {
      await updateUser();
      setLastChecked(new Date());
    } catch (err) {
      console.error('Status refresh failed:', err);
    } finally {
      if (isManual) setRefreshing(false);
    }
  }, [show, updateUser]);

  useEffect(() => {
    if (!show) return;
    const id = setInterval(() => checkStatus(false), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [show, checkStatus]);

  if (!show) return null;

  const cfg         = CONFIGS[status];
  if (!cfg) return null;

  const Icon        = cfg.Icon;
  const InfoIcon    = cfg.infoIcon;
  const note        = user?.account_approval_note || '';
  const company     = user?.company_name   || 'Your Company';
  const industry    = user?.company_industry || '';
  const size        = user?.company_size   || '';
  const phone       = user?.phone          || '';
  const email       = user?.email          || '';
  const reviewedAt  = user?.account_approval_reviewed_at;

  return (
    <div
      className={`w-full ${cfg.outerBg} ${cfg.borderTop} ${cfg.borderBot} transition-all duration-300`}
      role="alert"
      aria-live="polite"
    >
      {/* ── Clickable header row ─────────────────────────────────────────── */}
      <div
        className={`${cfg.headerBg} px-4 sm:px-6 py-3 cursor-pointer flex items-center justify-between gap-3 select-none`}
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Animated icon */}
          <div className={`relative flex-shrink-0 w-9 h-9 rounded-xl ${cfg.iconRing} flex items-center justify-center`}>
            <Icon size={18} className={cfg.iconColor} />
            {cfg.pulse && (
              <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${cfg.glowBar} border-2 border-white dark:border-gray-900 animate-pulse`} />
            )}
          </div>

          {/* Title */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className={`text-sm font-black ${cfg.titleColor} leading-tight`}>
                {cfg.title}
              </h3>
              <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full tracking-widest ${cfg.badgeBg} ${cfg.badgeText}`}>
                {cfg.badgeLabel}
              </span>
            </div>
            <p className={`text-[11px] font-semibold mt-0.5 ${cfg.subColor} hidden sm:block`}>
              Click to {expanded ? 'collapse' : 'expand'} details · All navigation is disabled until approved
            </p>
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Lock icon */}
          <div className={`hidden sm:flex items-center gap-1.5 text-[10px] font-black ${cfg.subColor} opacity-70`}>
            <LuLock size={12} />
            <span>App Locked</span>
          </div>
          {/* Expand/collapse chevron */}
          {expanded
            ? <LuChevronUp size={16} className={cfg.subColor} />
            : <LuChevronDown size={16} className={cfg.subColor} />}
        </div>
      </div>

      {/* ── Expanded body ────────────────────────────────────────────────── */}
      {expanded && (
        <div className="px-4 sm:px-6 py-5">
          <div className="max-w-5xl">

            {/* Summary paragraph */}
            <p className={`text-sm leading-relaxed font-medium ${cfg.subColor} mb-5`}>
              {cfg.summary(company)}
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* ── Left: Steps ── */}
              <div>
                <p className={`text-[10px] font-black uppercase tracking-widest mb-3 ${cfg.subColor} opacity-70`}>
                  What this means
                </p>
                <ul className="space-y-2.5">
                  {cfg.steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <div className={`flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-sm mt-0.5`}>
                        {step.icon}
                      </div>
                      <span className={`text-xs leading-relaxed font-medium ${cfg.stepText}`}>
                        {step.text}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* No-action note */}
                {cfg.noActionText && (
                  <div className={`mt-4 flex items-start gap-2 text-xs ${cfg.subColor} opacity-75`}>
                    <InfoIcon size={13} className="flex-shrink-0 mt-0.5" />
                    <p className="font-medium italic">{cfg.noActionText}</p>
                  </div>
                )}
              </div>

              {/* ── Right: Company info + note ── */}
              <div className="space-y-4">
                {/* Company details card */}
                <div>
                  <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${cfg.subColor} opacity-70`}>
                    Your Registration Details
                  </p>
                  <div className={`rounded-xl border ${cfg.noteBg} divide-y divide-current divide-opacity-10 overflow-hidden`}>
                    <InfoLine icon={<LuBuilding2 size={12} />} label="Company"  value={company}   cfg={cfg} />
                    {industry && <InfoLine icon={<LuBriefcase size={12} />} label="Industry" value={industry} cfg={cfg} />}
                    {size     && <InfoLine icon={<LuUser size={12} />}      label="Team Size" value={`${size} employees`} cfg={cfg} />}
                    {phone    && <InfoLine icon={<LuPhone size={12} />}    label="Phone"    value={phone}    cfg={cfg} />}
                    {email    && <InfoLine icon={<LuMail size={12} />}     label="Email"    value={email}    cfg={cfg} />}
                    <InfoLine
                      icon={<LuLock size={12} />}
                      label="Status"
                      value={
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${cfg.badgeBg} ${cfg.badgeText}`}>
                          {status}
                        </span>
                      }
                      cfg={cfg}
                    />
                    {reviewedAt && (
                      <InfoLine
                        icon={<LuCircleCheck size={12} />}
                        label="Reviewed On"
                        value={new Date(reviewedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        cfg={cfg}
                      />
                    )}
                  </div>
                </div>

                {/* Admin note / reason box */}
                {note && (
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${cfg.subColor} opacity-70`}>
                      {cfg.reasonLabel}
                    </p>
                    <div className={`rounded-xl border-l-4 p-3.5 ${cfg.noteBg} ${cfg.borderTop}`}>
                      <p className={`text-xs leading-relaxed font-semibold italic ${cfg.noteColor}`}>
                        "{note}"
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── Footer: contact + refresh ── */}
            <div className={`mt-5 pt-4 border-t ${cfg.divider} flex flex-wrap items-center justify-between gap-3`}>
              <div className="flex flex-wrap items-center gap-4">
                <a
                  href="mailto:support@strideo.app"
                  className={`flex items-center gap-1.5 text-[11px] font-bold underline underline-offset-2 transition ${cfg.linkColor}`}
                >
                  <LuMail size={12} />
                  support@strideo.app
                </a>
                {lastChecked && (
                  <span className={`text-[10px] font-semibold ${cfg.subColor} opacity-60`}>
                    Last checked: {lastChecked.toLocaleTimeString()}
                  </span>
                )}
              </div>

              {/* Manual refresh (only for pending) */}
              {status === 'pending' && (
                <button
                  onClick={(e) => { e.stopPropagation(); checkStatus(true); }}
                  disabled={refreshing}
                  className={`flex items-center gap-1.5 text-[11px] font-black transition disabled:opacity-50 cursor-pointer ${cfg.linkColor}`}
                >
                  <LuRefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
                  {refreshing ? 'Checking for approval…' : 'Check Approval Status'}
                </button>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

// ── Small helper ──────────────────────────────────────────────────────────────
const InfoLine = ({ icon, label, value, cfg }) => (
  <div className="flex items-center justify-between px-3.5 py-2.5 gap-3">
    <span className={`flex items-center gap-1.5 text-[10px] font-bold ${cfg.subColor} opacity-70 whitespace-nowrap`}>
      {icon} {label}
    </span>
    <span className={`text-[11px] font-bold ${cfg.noteColor} text-right truncate max-w-[60%]`}>
      {value}
    </span>
  </div>
);

export default ApprovalStatusBanner;
