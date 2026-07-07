import React from 'react';
import { Link } from 'react-router-dom';
import { LuMailX, LuArrowLeft, LuShield } from 'react-icons/lu';

/**
 * SetupExpired — shown when the setup link token is invalid, expired, or already used.
 * Props:
 *   reason: 'expired' | 'accepted' | 'invalid'  (default: 'expired')
 */
const SetupExpired = ({ reason = 'expired' }) => {
  const copy = {
    expired: {
      icon:    '⏰',
      title:   'Invitation Expired',
      body:    'This setup link has expired (links are valid for 7 days). Please contact your company admin to send a new invitation.',
      cta:     'Contact your admin',
    },
    accepted: {
      icon:    '✅',
      title:   'Already Set Up',
      body:    'This invitation link has already been used. Your account is active — go ahead and log in!',
      cta:     'Go to login',
    },
    invalid: {
      icon:    '🔗',
      title:   'Invalid Link',
      body:    'This setup link is not valid. It may have been revoked or the URL is incorrect. Please contact your company admin.',
      cta:     'Contact your admin',
    },
  }[reason] ?? {
    icon: '❓', title: 'Something went wrong', body: 'The setup link could not be validated.', cta: 'Go to login',
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-purple-900 to-black px-4">
      <div className="w-full max-w-md text-center">

        {/* Animated icon */}
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-400/30 flex items-center justify-center text-4xl animate-bounce-slow">
          {copy.icon}
        </div>

        {/* Card */}
        <div className="rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl p-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <LuShield className="text-purple-400" size={18} />
            <span className="text-xs text-purple-300 font-semibold tracking-wide uppercase">
              Strideo · Account Setup
            </span>
          </div>

          <LuMailX className="text-red-400 mx-auto mb-4" size={40} />
          <h1 className="text-2xl font-bold text-white mb-3">{copy.title}</h1>
          <p className="text-white/60 text-sm leading-relaxed mb-8">{copy.body}</p>

          <Link
            to="/login"
            className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-3 rounded-xl hover:opacity-90 transition shadow-lg shadow-blue-600/30"
          >
            <LuArrowLeft size={16} />
            {reason === 'accepted' ? 'Log In to Your Account' : 'Back to Login'}
          </Link>
        </div>

        <p className="text-white/30 text-xs mt-4">
          Need help? Email your company admin or contact{' '}
          <a href="mailto:support@strideo.app" className="text-blue-400 hover:underline">
            support@strideo.app
          </a>
        </p>
      </div>

      {/* Subtle background animation */}
      <style>{`
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .animate-bounce-slow { animation: bounce-slow 3s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

export default SetupExpired;
