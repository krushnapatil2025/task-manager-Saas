import React, { useState, useContext, useEffect } from 'react';
import AuthLayout from '../../components/layouts/AuthLAyout';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { DEFAULT_BRAND, applyCSSVariables } from '../../context/BrandContext';
import Input from '../../components/Inputs/Input';
import { validateEmail } from '../../utils/helper';
import { supabase } from '../../utils/supabaseClient';
import { UserContext } from '../../context/userContext';
import { superAdminLogin } from '../../utils/superAdminSession';
import toast from 'react-hot-toast';
import { LuLoaderCircle, LuMail, LuLock, LuSparkles } from 'react-icons/lu';

// Google "G" logo SVG (inline — no external dependency)
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [magicSent, setMagicSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('password'); // 'password' | 'magic'

  const { user, updateUser } = useContext(UserContext);
  const navigate = useNavigate();
  const location = useLocation();
  const sessionExpired = location.state?.sessionExpired === true;

  useEffect(() => {
    applyCSSVariables(DEFAULT_BRAND);
  }, []);

  // Redirect if already logged in (resolves mobile/SPA cold start race conditions)
  useEffect(() => {
    if (user) {
      const isAdmin = user.role === 'admin' || user.job_profile === 'company_admin';
      navigate(isAdmin ? '/admin/dashboard' : '/user/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const companyName = 'Strideo';

  // ── Email/password login ──────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateEmail(email)) return setError('Please enter a valid email address.');
    if (!password) return setError('Password cannot be empty.');

    setLoading(true);
    try {
      // ── Super Admin: check .env credentials ────────────────────────────────
      if (superAdminLogin(email, password)) {
        // Also authenticate with Supabase so RLS (is_super_admin=true) allows
        // platform-wide queries in the SA panel. Silent — local session is truth.
        await supabase.auth.signInWithPassword({ email, password }).catch(() => {});

        toast.success('Welcome, Super Admin! 🛡️');
        navigate('/super-admin/dashboard');
        return;
      }

      // ── Normal users: authenticate via Supabase ────────────────────────────
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;

      await updateUser();

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, job_profile')
        .eq('id', data.user.id)
        .maybeSingle();

      toast.success('Welcome back!');
      const isAdmin = profile?.role === 'admin' || profile?.job_profile === 'company_admin';
      navigate(isAdmin ? '/admin/dashboard' : '/user/dashboard');
    } catch (err) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  // ── Google OAuth ──────────────────────────────────────────────────────────
  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      });
      if (error) throw error;
    } catch (err) {
      setError(err.message || 'Google login failed.');
      setLoading(false);
    }
  };

  // ── Magic Link ────────────────────────────────────────────────────────────
  const handleMagicLink = async (e) => {
    e.preventDefault();
    setError('');
    if (!validateEmail(email)) return setError('Please enter a valid email address.');

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          shouldCreateUser: false, // only existing users
        },
      });
      if (error) throw error;
      setMagicSent(true);
      toast.success('Magic link sent! Check your email.');
    } catch (err) {
      setError(err.message || 'Failed to send magic link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Welcome Back" subtitle={`Sign in to your ${companyName} workspace`}>
      {/* ── Session expired banner ── */}
      {sessionExpired && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(251,146,60,0.12), rgba(239,68,68,0.08))',
          border: '1px solid rgba(251,146,60,0.35)',
          borderRadius: '12px',
          padding: '10px 14px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <span style={{ fontSize: '1.1rem' }}>⏱️</span>
          <p style={{ fontSize: '0.8rem', color: '#92400e', fontWeight: 600, margin: 0 }}>
            Your session expired after 6 hours of inactivity. Please sign in again.
          </p>
        </div>
      )}
      {/* ── Tab switcher ── */}
      <div className="flex gap-2 bg-slate-50 border border-slate-200/50 rounded-xl p-1 mb-6">
        {['password', 'magic'].map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setError(''); setMagicSent(false); }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-all duration-155 cursor-pointer flex items-center justify-center gap-1.5 ${tab === t
                ? 'bg-white shadow-sm border border-slate-100 text-indigo-600'
                : 'text-slate-500 hover:text-slate-800'
              }`}
          >
            {t === 'password' ? (
              <>
                <LuLock size={12} /> Password
              </>
            ) : (
              <>
                <LuSparkles size={12} /> Magic Link
              </>
            )}
          </button>
        ))}
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="text-red-650 text-xs mb-4 text-center bg-red-50 border border-red-200 rounded-xl px-3 py-2 font-bold">
          {error}
        </div>
      )}

      {/* ── Password form ── */}
      {tab === 'password' && (
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <Input
            value={email}
            onChange={({ target }) => setEmail(target.value)}
            label="Email Address"
            placeholder="you@company.com"
            type="text"
            autoComplete="email"
          />
          <Input
            value={password}
            onChange={({ target }) => setPassword(target.value)}
            label="Password"
            placeholder="••••••••"
            type="password"
            autoComplete="current-password"
          />
          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 text-white bg-indigo-600 hover:bg-indigo-700 font-bold py-2.5 rounded-xl shadow-lg transition disabled:opacity-60 mt-1 cursor-pointer"
          >
            {loading ? <LuLoaderCircle className="animate-spin" size={16} /> : null}
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      )}

      {/* ── Magic link form ── */}
      {tab === 'magic' && (
        <>
          {magicSent ? (
            <div className="text-center py-4">
              <LuMail className="text-5xl text-indigo-650 mx-auto mb-3" />
              <p className="text-slate-900 font-black">Check your inbox!</p>
              <p className="text-slate-500 text-xs mt-1.5 font-semibold">
                A magic link was sent to <strong>{email}</strong>.<br />
                Click the link to sign in instantly.
              </p>
              <button
                onClick={() => setMagicSent(false)}
                className="text-xs text-indigo-650 hover:text-indigo-700 hover:underline mt-4 font-bold cursor-pointer"
              >
                Send again
              </button>
            </div>
          ) : (
            <form onSubmit={handleMagicLink} className="flex flex-col gap-4">
              <Input
                value={email}
                onChange={({ target }) => setEmail(target.value)}
                label="Email Address"
                placeholder="you@company.com"
                type="text"
                autoComplete="email"
              />
              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center gap-2 text-white bg-indigo-600 hover:bg-indigo-700 font-bold py-2.5 rounded-xl shadow-lg transition disabled:opacity-60 cursor-pointer"
              >
                {loading ? <LuLoaderCircle className="animate-spin" size={16} /> : <LuMail className="text-base" />}
                {loading ? 'Sending...' : 'Send Magic Link'}
              </button>
            </form>
          )}
        </>
      )}

      {/* ── Divider ── */}
      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-slate-400 text-xs font-semibold">or continue with</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      {/* ── Google OAuth ── */}
      <button
        onClick={handleGoogleLogin}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-700 font-bold py-2.5 rounded-xl shadow border border-slate-200 transition disabled:opacity-60 cursor-pointer"
      >
        <GoogleIcon />
        Continue with Google
      </button>

      <p className="text-xs text-slate-500 mt-6 text-center font-bold">
        Company admin?{' '}
        <Link to="/admin/register" className="text-indigo-600 hover:text-indigo-700 hover:underline font-extrabold">
          Register your company
        </Link>
      </p>
    </AuthLayout>
  );
};

export default Login;