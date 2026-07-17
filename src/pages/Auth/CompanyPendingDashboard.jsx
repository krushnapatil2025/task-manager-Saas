import React, { useContext, useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserContext } from '../../context/userContext';
import { useBrand } from '../../context/BrandContext';
import {
  LuTriangleAlert,
  LuClock,
  LuCircleX,
  LuLogOut,
  LuMail,
  LuBuilding2,
  LuRefreshCw,
  LuCircleCheck,
  LuShield,
  LuPhone,
  LuUser,
  LuBriefcase,
} from 'react-icons/lu';
import { toast } from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// CompanyPendingDashboard
// Shown to company admins whose profile.account_approval_status ≠ 'approved'.
// Reads status directly from UserContext (profiles row) — NOT from the workspace.
// Auto-polls every 30s so admins are redirected as soon as SA approves.
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  pending: {
    icon:        LuClock,
    iconBg:      'bg-amber-500/10 border-amber-500/20',
    iconColor:   'text-amber-400',
    animate:     'animate-pulse',
    heading:     'Awaiting Super Admin Review',
    badge:       'bg-amber-500/10 text-amber-400 border-amber-500/20',
    description: 'Your company registration is in the review queue. Our platform administrator will verify your details within 1–2 business days.',
  },
  rejected: {
    icon:        LuCircleX,
    iconBg:      'bg-rose-500/10 border-rose-500/20',
    iconColor:   'text-rose-400',
    animate:     '',
    heading:     'Registration Declined',
    badge:       'bg-rose-500/10 text-rose-400 border-rose-500/20',
    description: 'We were unable to approve your registration at this time. Please review the reason below and contact our support team for assistance.',
  },
  restricted: {
    icon:        LuTriangleAlert,
    iconBg:      'bg-red-500/10 border-red-500/20',
    iconColor:   'text-red-400',
    animate:     '',
    heading:     'Account Restricted',
    badge:       'bg-red-500/10 text-red-400 border-red-500/20',
    description: 'Access to this account has been restricted by the platform administrator. Please contact our support team to resolve this.',
  },
};

const POLL_INTERVAL_MS = 30_000; // 30 seconds

const CompanyPendingDashboard = () => {
  const { user, clearUser, updateUser } = useContext(UserContext);
  const { brand } = useBrand();
  const navigate  = useNavigate();

  const [refreshing,    setRefreshing]    = useState(false);
  const [lastChecked,   setLastChecked]   = useState(new Date());
  const [justApproved,  setJustApproved]  = useState(false);

  // ── Read approval data from the user's PROFILE (not workspace) ────────────
  const status    = user?.account_approval_status || 'pending';
  const reason    = user?.account_approval_note   || '';
  const company   = user?.company_name            || user?.name || '—';
  const industry  = user?.company_industry        || '';
  const size      = user?.company_size            || '';
  const phone     = user?.phone                   || '';

  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const StatusIcon = cfg.icon;

  // ── Poll for status change ────────────────────────────────────────────────
  const checkStatus = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      await updateUser();
      setLastChecked(new Date());
    } catch (err) {
      console.error('Failed to refresh approval status:', err);
    } finally {
      if (isManual) setRefreshing(false);
    }
  }, [updateUser]);

  // Watch for approval after a refresh
  useEffect(() => {
    if (user?.account_approval_status === 'approved') {
      setJustApproved(true);
      const t = setTimeout(() => navigate('/admin/dashboard', { replace: true }), 2500);
      return () => clearTimeout(t);
    }
  }, [user?.account_approval_status, navigate]);

  // Auto-poll every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => checkStatus(false), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [checkStatus]);

  const handleLogout = async () => {
    await clearUser();
    toast.success('Successfully logged out!');
    navigate('/');
  };

  const handleManualRefresh = () => checkStatus(true);

  // ── "Just approved" success state ────────────────────────────────────────
  if (justApproved) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 font-sans">
        <div className="w-full max-w-md bg-slate-950 border border-green-500/30 rounded-3xl p-10 shadow-2xl text-center space-y-4">
          <div className="w-16 h-16 bg-green-500/10 rounded-2xl flex items-center justify-center text-green-400 border border-green-500/20 mx-auto mb-2 animate-bounce">
            <LuCircleCheck size={32} />
          </div>
          <h2 className="text-xl font-black text-white">Account Approved! 🎉</h2>
          <p className="text-slate-400 text-sm">Redirecting you to your dashboard…</p>
          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mt-2" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.025] bg-[radial-gradient(rgba(255,255,255,0.15)_1px,transparent_1px)] bg-[size:16px_16px]" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-3xl pointer-events-none" />

      {/* Main card */}
      <div className="w-full max-w-lg bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl relative z-10 overflow-hidden">

        {/* Status color bar at top */}
        <div className={`h-1 w-full ${
          status === 'pending'    ? 'bg-gradient-to-r from-amber-500 to-orange-500' :
          status === 'rejected'   ? 'bg-gradient-to-r from-rose-600 to-red-500' :
          'bg-gradient-to-r from-red-600 to-red-800'
        }`} />

        <div className="p-8 md:p-10">
          {/* Brand Header */}
          <Link to="/" className="flex items-center gap-2.5 mb-8 select-none justify-center hover:opacity-85 transition-opacity">
            <img src="/logo.png" className="w-7 h-7 object-contain rounded" alt="Logo" onError={(e) => { e.target.style.display = 'none'; }} />
            <span className="text-sm font-black text-white tracking-tight">{brand.companyName || 'Strideo'}</span>
          </Link>

          {/* Status Icon & Heading */}
          <div className="flex flex-col items-center text-center mb-7">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border mb-5 ${cfg.iconBg} ${cfg.iconColor} ${cfg.animate}`}>
              <StatusIcon size={30} />
            </div>
            <h1 className="text-lg font-black text-white mb-1">{cfg.heading}</h1>
            <p className="text-slate-400 text-xs leading-relaxed max-w-sm">{cfg.description}</p>
          </div>

          {/* Reason Box for Rejection or Restriction */}
          {status !== 'pending' && reason && (
            <div className={`mb-6 p-4 rounded-xl border text-xs text-left ${
              status === 'rejected'
                ? 'bg-rose-950/30 border-rose-500/20'
                : 'bg-red-950/30 border-red-500/20'
            }`}>
              <span className={`text-[10px] font-black uppercase tracking-wider block mb-1.5 ${
                status === 'rejected' ? 'text-rose-400' : 'text-red-400'
              }`}>
                📋 Reason from review team:
              </span>
              <p className="text-slate-300 leading-relaxed font-medium italic">"{reason}"</p>
            </div>
          )}

          {/* Company Details Card */}
          <div className="w-full bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden mb-5">
            <div className="px-4 py-2.5 bg-slate-900/80 border-b border-slate-800/80">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Company Details</span>
            </div>
            <div className="divide-y divide-slate-800/60">
              <DetailRow icon={<LuBuilding2 size={11} className="text-indigo-400" />} label="Company Name" value={company} />
              {industry && <DetailRow icon={<LuBriefcase size={11} className="text-indigo-400" />} label="Industry"      value={industry} />}
              {size     && <DetailRow icon={<LuUser size={11} className="text-indigo-400" />}      label="Team Size"    value={`${size} employees`} />}
              {phone    && <DetailRow icon={<LuPhone size={11} className="text-indigo-400" />}     label="Phone"        value={phone} />}
              <DetailRow
                icon={<LuShield size={11} className="text-indigo-400" />}
                label="Approval Status"
                value={
                  <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${cfg.badge}`}>
                    {status}
                  </span>
                }
              />
            </div>
          </div>

          {/* Last Checked + Manual Refresh */}
          {status === 'pending' && (
            <div className="flex items-center justify-between mb-5 px-1">
              <p className="text-[10px] text-slate-600 font-semibold">
                Auto-checking every 30s · Last: {lastChecked.toLocaleTimeString()}
              </p>
              <button
                onClick={handleManualRefresh}
                disabled={refreshing}
                className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition disabled:opacity-50 cursor-pointer"
              >
                <LuRefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
                {refreshing ? 'Checking…' : 'Check Now'}
              </button>
            </div>
          )}

          {/* Footer Contact */}
          <div className="text-center mb-5">
            <p className="text-[10px] text-slate-500 font-semibold flex items-center justify-center gap-1.5">
              <LuMail size={11} className="text-indigo-500" />
              Questions? Contact{' '}
              <a
                href="mailto:support@strideo.app"
                className="text-indigo-400 hover:underline ml-0.5"
              >
                support@strideo.app
              </a>
            </p>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="w-full py-2.5 rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-900/40 text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition"
          >
            <LuLogOut size={13} />
            Sign Out of Account
          </button>
        </div>
      </div>

      {/* Bottom note */}
      <p className="text-[10px] text-slate-600 font-semibold mt-6 text-center">
        © {new Date().getFullYear()} Strideo. All rights reserved. Built by{' '}
        <a href="https://www.cicdtech.in/" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-slate-400">
          CICD Tech
        </a>
      </p>
    </div>
  );
};

// ── Helper component ──────────────────────────────────────────────────────────
const DetailRow = ({ icon, label, value }) => (
  <div className="flex items-center justify-between px-4 py-2.5 text-[11px]">
    <span className="text-slate-500 font-bold flex items-center gap-1.5">
      {icon} {label}
    </span>
    <span className="text-slate-200 font-bold text-right max-w-[200px] truncate">
      {value}
    </span>
  </div>
);

export default CompanyPendingDashboard;
