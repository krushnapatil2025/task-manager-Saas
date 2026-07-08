import React from 'react';
import { Link } from 'react-router-dom';
import { LuMailX, LuArrowLeft, LuClock, LuCircleCheck, LuShieldAlert } from 'react-icons/lu';

/**
 * SetupExpired — shown when the setup link token is invalid, expired, or already used.
 * Props:
 *   reason: 'expired' | 'accepted' | 'invalid'  (default: 'expired')
 */
const SetupExpired = ({ reason = 'expired' }) => {
  const getCopy = () => {
    switch (reason) {
      case 'accepted':
        return {
          icon: <LuCircleCheck className="text-green-500 dark:text-green-400" size={28} />,
          iconBg: 'bg-green-500/10 border-green-500/25',
          title: 'Already Set Up',
          body: 'This invitation link has already been used. Your account is active — go ahead and log in!',
          cta: 'Go to login',
        };
      case 'invalid':
        return {
          icon: <LuShieldAlert className="text-amber-500 dark:text-amber-400" size={28} />,
          iconBg: 'bg-amber-500/10 border-amber-500/25',
          title: 'Invalid Setup Link',
          body: 'This setup link is not valid. It may have been revoked or the URL is incorrect. Please contact your admin.',
          cta: 'Back to Login',
        };
      case 'expired':
      default:
        return {
          icon: <LuClock className="text-red-500 dark:text-red-400" size={28} />,
          iconBg: 'bg-red-500/10 border-red-500/25',
          title: 'Invitation Expired',
          body: 'This setup link has expired (links are valid for 7 days). Please contact your company admin to send a new invitation.',
          cta: 'Back to Login',
        };
    }
  };

  const copy = getCopy();

  return (
    <div className="min-h-screen w-full flex items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_35%_50%,#1e253e_0%,#0a0b0e_100%)] transition-colors duration-300 font-sans antialiased p-4">
      {/* Floating Card container */}
      <div className="w-full max-w-[420px] bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800/80 shadow-2xl rounded-3xl p-8 md:p-10 transition-all duration-300">
        
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8 select-none justify-center">
          <img src="/logo.png" className="w-5 h-5 object-contain rounded bg-slate-100 dark:bg-zinc-800 p-0.5" alt="Logo" />
          <span className="text-[10px] font-black text-slate-800 dark:text-zinc-200 uppercase tracking-widest">STRIDEO</span>
        </div>

        {/* Animated Icon Circle */}
        <div className={`w-16 h-16 rounded-full ${copy.iconBg} border flex items-center justify-center mx-auto mb-6 shadow-sm animate-bounce-slow`}>
          {copy.icon}
        </div>

        {/* Text Details */}
        <div className="text-center mb-8">
          <h2 className="text-base font-black text-slate-900 dark:text-zinc-100 tracking-tight">
            {copy.title}
          </h2>
          <p className="text-xs font-semibold text-slate-450 dark:text-zinc-450 mt-2.5 leading-relaxed max-w-[280px] mx-auto">
            {copy.body}
          </p>
        </div>

        {/* Back Link Button */}
        <Link
          to="/login"
          className="w-full flex items-center justify-center gap-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-bold text-[10px] uppercase tracking-widest py-3 rounded-xl shadow-lg transition duration-200 cursor-pointer"
        >
          <LuArrowLeft size={13} className="stroke-[3px]" />
          {copy.cta}
        </Link>

        {/* Support Link Footer */}
        <p className="text-[9px] text-slate-400 dark:text-zinc-550 font-bold uppercase tracking-wider text-center mt-8 pt-4 border-t border-slate-100 dark:border-zinc-800/50">
          Need help? Contact{' '}
          <a href="mailto:support@strideo.app" className="text-[#2563eb] dark:text-[#60a5fa] hover:underline">
            support@strideo.app
          </a>
        </p>
      </div>

      {/* Subtle bounce animation style */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        .animate-bounce-slow { animation: bounce-slow 3s ease-in-out infinite; }
      `}} />
    </div>
  );
};

export default SetupExpired;
