import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../utils/supabaseClient';
import { getInvitationByToken, acceptInvitation } from '../../services/invitationService';
import { LuBuilding2, LuLoaderCircle, LuCircleCheck, LuCircleAlert, LuArrowRight } from 'react-icons/lu';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// AcceptInvite — public page loaded when a user clicks an invite link.
// URL: /invite/:token
//
// Flow:
//   1. Validate token, show workspace details
//   2. If user is not logged in → redirect to login with ?next=/invite/<token>
//   3. If logged in → call acceptInvitation RPC, then redirect to dashboard
// ─────────────────────────────────────────────────────────────────────────────

const AcceptInvite = () => {
  const { token }  = useParams();
  const navigate   = useNavigate();

  const [invite,   setInvite]   = useState(null);
  const [session,  setSession]  = useState(undefined); // undefined = loading
  const [status,   setStatus]   = useState('loading'); // 'loading'|'valid'|'invalid'|'accepted'|'accepting'
  const [errorMsg, setErrorMsg] = useState('');

  // ── 1. Load session and invitation simultaneously ─────────────────────────
  useEffect(() => {
    const init = async () => {
      const [{ data: { session: s } }, inviteResult] = await Promise.allSettled([
        supabase.auth.getSession(),
        getInvitationByToken(token),
      ]);

      const currentSession = s?.value?.session || null;
      setSession(currentSession);

      if (inviteResult.status === 'rejected') {
        setStatus('invalid');
        setErrorMsg('This invitation link is invalid or has expired.');
        return;
      }

      const inv = inviteResult.value;
      setInvite(inv);

      if (inv.isAccepted) {
        setStatus('invalid');
        setErrorMsg('This invitation has already been accepted.');
        return;
      }

      if (inv.isExpired) {
        setStatus('invalid');
        setErrorMsg('This invitation link has expired. Please ask your admin for a new one.');
        return;
      }

      setStatus('valid');
    };

    if (token) init();
  }, [token]);

  // ── 2. Accept the invitation ──────────────────────────────────────────────
  const handleAccept = async () => {
    if (!session) {
      // Not logged in → go to login, come back after
      navigate(`/login?next=/invite/${token}`);
      return;
    }

    setStatus('accepting');
    try {
      await acceptInvitation(token);
      setStatus('accepted');
      toast.success(`Joined "${invite?.workspaceName}" successfully! 🎉`);

      // Redirect after short delay
      setTimeout(() => navigate('/user/dashboard'), 2000);
    } catch (err) {
      console.error('Accept invitation error:', err);
      setErrorMsg(err.message || 'Failed to accept invitation.');
      setStatus('valid');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-indigo-900 to-purple-900 flex items-center justify-center px-4">
      {/* Ambient glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl">

          {/* ── Loading ── */}
          {(status === 'loading' || session === undefined) && (
            <div className="flex flex-col items-center gap-4 py-8">
              <LuLoaderCircle className="text-blue-300 text-4xl animate-spin" />
              <p className="text-white/70 text-sm">Validating invitation...</p>
            </div>
          )}

          {/* ── Invalid ── */}
          {status === 'invalid' && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center">
                <LuCircleAlert className="text-red-400 text-3xl" />
              </div>
              <h2 className="text-xl font-bold text-white text-center">Invitation Invalid</h2>
              <p className="text-white/60 text-sm text-center">{errorMsg}</p>
              <button
                onClick={() => navigate('/login')}
                className="mt-2 text-sm text-blue-300 hover:text-blue-200 underline"
              >
                Go to Login
              </button>
            </div>
          )}

          {/* ── Accepted ── */}
          {status === 'accepted' && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="w-16 h-16 rounded-2xl bg-lime-500/20 flex items-center justify-center">
                <LuCircleCheck className="text-lime-400 text-3xl" />
              </div>
              <h2 className="text-xl font-bold text-white text-center">You're In!</h2>
              <p className="text-white/60 text-sm text-center">
                Successfully joined <strong className="text-white">{invite?.workspaceName}</strong>.
                Redirecting...
              </p>
              <LuLoaderCircle className="text-white/40 animate-spin" />
            </div>
          )}

          {/* ── Valid invitation ── */}
          {(status === 'valid' || status === 'accepting') && invite && (
            <>
              {/* Workspace card */}
              <div className="flex flex-col items-center mb-7">
                {invite.workspaceLogo ? (
                  <img
                    src={invite.workspaceLogo}
                    className="w-16 h-16 rounded-2xl object-cover shadow-lg mb-3"
                    alt={invite.workspaceName}
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30 mb-3">
                    <LuBuilding2 className="text-white text-3xl" />
                  </div>
                )}

                <p className="text-white/60 text-sm">You've been invited to join</p>
                <h2 className="text-2xl font-bold text-white mt-0.5">{invite.workspaceName}</h2>

                <span className="mt-2 text-xs font-semibold text-blue-300 bg-blue-500/20 px-3 py-1 rounded-full border border-blue-400/30 capitalize">
                  Role: {invite.role}
                </span>
              </div>

              {/* Auth status note */}
              {!session && (
                <div className="bg-amber-500/15 border border-amber-400/30 rounded-xl px-4 py-3 text-amber-200 text-xs mb-5 text-center">
                  You'll need to log in before joining this workspace.
                </div>
              )}

              {errorMsg && (
                <div className="bg-red-500/15 border border-red-400/30 rounded-xl px-4 py-3 text-red-300 text-xs mb-4 text-center">
                  {errorMsg}
                </div>
              )}

              <button
                onClick={handleAccept}
                disabled={status === 'accepting'}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-3 rounded-xl shadow-lg shadow-blue-500/30 transition-all disabled:opacity-60"
              >
                {status === 'accepting'
                  ? <><LuLoaderCircle className="animate-spin" /> Joining...</>
                  : session
                    ? <><LuCircleCheck /> Accept Invitation</>
                    : <><LuArrowRight /> Log In & Join</>
                }
              </button>

              <p className="text-xs text-white/30 text-center mt-4">
                Expires {new Date(invite.expiresAt).toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AcceptInvite;
