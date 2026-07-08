import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLayout from '../../components/layouts/AuthLAyout';
import { validateEmail } from '../../utils/helper';
import {
  generateResetOtp,
  verifyResetOtp,
  resetPasswordWithOtp,
  sendResetOtpEmail
} from '../../services/userService';
import toast from 'react-hot-toast';
import {
  LuLoaderCircle,
  LuCircleCheck,
  LuMail,
  LuLock,
  LuEye,
  LuEyeOff,
  LuChevronRight,
  LuChevronLeft,
  LuPartyPopper,
  LuKey
} from 'react-icons/lu';

// ── password strength helper ──────────────────────────────────────────────────
const checkLength = (pw) => pw.length >= 8;
const checkUpper = (pw) => /[A-Z]/.test(pw);
const checkNumberOrSymbol = (pw) => /[0-9]|[^A-Za-z0-9]/.test(pw);

const ForgotPassword = () => {
  const navigate = useNavigate();

  // Wizard state
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form states
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');

  // Password visibility toggles
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // ── Step 0: Send OTP ──
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      // 1. Generate OTP in database
      const generatedOtp = await generateResetOtp(email);

      if (!generatedOtp) {
        setError('This email address is not registered in our system.');
        setLoading(false);
        return;
      }

      // 2. Dispatch email via Brevo
      const emailSent = await sendResetOtpEmail(email, generatedOtp);

      if (emailSent) {
        toast.success('Verification code sent to your email! 📧');
        setStep(1);
      } else {
        setError('Failed to send verification email. Please try again.');
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 1: Verify OTP ──
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');

    if (otp.trim().length !== 6) {
      setError('Verification code must be exactly 6 digits.');
      return;
    }

    setLoading(true);
    try {
      const isValid = await verifyResetOtp(email, otp);

      if (isValid) {
        toast.success('Verification successful! 🔒');
        setStep(2);
      } else {
        setError('Invalid or expired verification code. Please check your email.');
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Reset Password ──
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');

    if (!checkLength(newPw)) return setError('Password must be at least 8 characters.'), false;
    if (!checkUpper(newPw)) return setError('Password must contain at least one uppercase letter.'), false;
    if (!checkNumberOrSymbol(newPw)) return setError('Password must contain a number or special character.'), false;
    if (newPw !== confirmPw) return setError('Passwords do not match.'), false;

    setLoading(true);
    try {
      const success = await resetPasswordWithOtp(email, otp, newPw);

      if (success) {
        toast.success('Password reset successful! 🎉');
        setStep(3);
        // Redirect to login page after 3 seconds
        setTimeout(() => {
          navigate('/login');
        }, 3500);
      } else {
        setError('Failed to update password. Your verification code might have expired.');
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Password update failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setError('');
    if (step > 0) {
      setStep((s) => s - 1);
    }
  };

  return (
    <AuthLayout variant="split-card" step={step} title="Reset Password" subtitle="Recover your Strideo workspace credentials">
      <div className="w-full font-sans select-none">
        {/* Floating Custom Styles for Premium Light Theme */}
        <style dangerouslySetInnerHTML={{__html: `
          .reset-input {
            width: 100%;
            background: #ffffff;
            border: 1px solid #cbd5e1;
            border-radius: 0.75rem;
            padding: 0.65rem 0.85rem;
            color: #0f172a;
            font-size: 0.875rem;
            font-weight: 500;
            outline: none;
            transition: all 0.2s;
          }
          .reset-input:focus {
            border-color: #4f46e5;
            box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15);
          }
          .reset-btn-primary {
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            background: #4f46e5;
            color: #ffffff;
            font-weight: 700;
            font-size: 0.825rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            padding: 0.75rem 1.2rem;
            border-radius: 0.75rem;
            box-shadow: 0 4px 10px rgba(79, 70, 229, 0.2);
            transition: all 0.2s;
            cursor: pointer;
            border: none;
          }
          .reset-btn-primary:hover {
            background: #4338ca;
            box-shadow: 0 6px 14px rgba(79, 70, 229, 0.3);
          }
          .reset-btn-ghost {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.25rem;
            background: #f8fafc;
            color: #475569;
            font-weight: 700;
            font-size: 0.825rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            padding: 0.75rem 1.2rem;
            border-radius: 0.75rem;
            border: 1px solid #e2e8f0;
            transition: all 0.2s;
            cursor: pointer;
          }
          .reset-btn-ghost:hover {
            background: #f1f5f9;
            color: #1e293b;
          }
          .no-scrollbar::-webkit-scrollbar {
            display: none;
          }
          .no-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}} />

        {error && (
          <div className="text-red-600 text-xs text-center bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 font-bold mb-4">
            ⚠️ {error}
          </div>
        )}

        {/* Vertical Slider Frame Container */}
        <div className="relative overflow-hidden h-[460px] w-full no-scrollbar">
          <div
            className="absolute top-0 left-0 w-full flex flex-col transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ transform: `translateY(-${step * 460}px)` }}
          >
            {/* ════════════════ STEP 0: Ask Email ════════════════ */}
            <div className="h-[460px] w-full flex flex-col justify-between shrink-0 pb-2">
              <form onSubmit={handleSendOtp} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60 mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center">
                        <LuMail className="text-indigo-600 text-lg" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm">Enter Account Email</h4>
                        <p className="text-[11px] text-slate-500 font-medium">We'll send a 6-digit verification code</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-slate-550 font-bold uppercase tracking-wider select-none">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="reset-input"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="reset-btn-primary mt-4"
                >
                  {loading ? <LuLoaderCircle className="animate-spin" size={14} /> : <LuChevronRight size={14} />}
                  {loading ? 'Sending Code...' : 'Send Verification Code'}
                </button>
              </form>

              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-extrabold hover:underline cursor-pointer"
                >
                  Back to Sign In
                </button>
              </div>
            </div>

            {/* ════════════════ STEP 1: Enter OTP ════════════════ */}
            <div className="h-[460px] w-full flex flex-col justify-between shrink-0 pb-2">
              <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60 mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center">
                        <LuKey className="text-indigo-600 text-lg" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm">Verify OTP</h4>
                        <p className="text-[11px] text-slate-500 font-medium">Sent to: <span className="font-bold">{email}</span></p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-slate-550 font-bold uppercase tracking-wider select-none">
                      6-Digit Code
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="000000"
                      className="reset-input tracking-widest text-center text-lg font-black"
                      required
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-4">
                  <button type="button" onClick={handleBack} className="reset-btn-ghost flex-1">
                    <LuChevronLeft size={14} /> Back
                  </button>
                  <button type="submit" disabled={loading} className="reset-btn-primary flex-[2]">
                    {loading ? <LuLoaderCircle className="animate-spin" size={14} /> : <LuCircleCheck size={14} />}
                    {loading ? 'Verifying...' : 'Verify OTP Code'}
                  </button>
                </div>
              </form>

              <div className="flex justify-center text-xs text-slate-500">
                Didn't receive the code?{' '}
                <button
                  type="button"
                  onClick={handleSendOtp}
                  className="text-indigo-600 hover:text-indigo-750 font-extrabold ml-1 hover:underline cursor-pointer"
                >
                  Resend Email
                </button>
              </div>
            </div>

            {/* ════════════════ STEP 2: Create Password ════════════════ */}
            <div className="h-[460px] w-full flex flex-col justify-between shrink-0 pb-2 overflow-y-auto no-scrollbar">
              <form onSubmit={handleResetPassword} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-slate-550 font-bold uppercase tracking-wider select-none">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNew ? 'text' : 'password'}
                      value={newPw}
                      onChange={(e) => setNewPw(e.target.value)}
                      placeholder="Enter new secure password"
                      className="reset-input pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showNew ? <LuEyeOff size={14} /> : <LuEye size={14} />}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-slate-550 font-bold uppercase tracking-wider select-none">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPw}
                      onChange={(e) => setConfirmPw(e.target.value)}
                      placeholder="Re-enter your new password"
                      className="reset-input pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showConfirm ? <LuEyeOff size={14} /> : <LuEye size={14} />}
                    </button>
                  </div>
                </div>

                {/* Password Strength Checklist */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/50 mt-1">
                  <span className="text-[9px] font-mono tracking-widest uppercase text-slate-400 block mb-1.5">Password Requirements</span>
                  <ul className="space-y-1 text-[10px]">
                    <li className={`flex items-center gap-2 font-semibold ${checkLength(newPw) ? 'text-indigo-600' : 'text-slate-400'}`}>
                      <LuCircleCheck size={11} className={checkLength(newPw) ? 'stroke-[3px]' : 'opacity-40'} />
                      At least 8 characters
                    </li>
                    <li className={`flex items-center gap-2 font-semibold ${checkUpper(newPw) ? 'text-indigo-600' : 'text-slate-400'}`}>
                      <LuCircleCheck size={11} className={checkUpper(newPw) ? 'stroke-[3px]' : 'opacity-40'} />
                      Contains at least one uppercase letter
                    </li>
                    <li className={`flex items-center gap-2 font-semibold ${checkNumberOrSymbol(newPw) ? 'text-indigo-600' : 'text-slate-400'}`}>
                      <LuCircleCheck size={11} className={checkNumberOrSymbol(newPw) ? 'stroke-[3px]' : 'opacity-40'} />
                      Contains a number or special symbol
                    </li>
                    {confirmPw && (
                      <li className={`flex items-center gap-2 font-semibold ${newPw === confirmPw ? 'text-indigo-600' : 'text-red-500'}`}>
                        <LuCircleCheck size={11} className={newPw === confirmPw ? 'stroke-[3px]' : 'opacity-40'} />
                        Passwords match
                      </li>
                    )}
                  </ul>
                </div>

                <div className="flex gap-3 mt-3">
                  <button type="button" onClick={handleBack} className="reset-btn-ghost flex-1">
                    <LuChevronLeft size={14} /> Back
                  </button>
                  <button type="submit" disabled={loading} className="reset-btn-primary flex-[2]">
                    {loading ? <LuLoaderCircle className="animate-spin" size={14} /> : <LuPartyPopper size={14} />}
                    {loading ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>

            {/* ════════════════ STEP 3: Success Screen ════════════════ */}
            <div className="h-[460px] w-full flex flex-col justify-center items-center text-center pb-2 select-none">
              <div className="w-20 h-20 rounded-full bg-indigo-50 border-4 border-indigo-100 flex items-center justify-center mb-6 relative">
                <div className="absolute inset-0 rounded-full border border-indigo-500 animate-ping opacity-30" />
                <LuCircleCheck className="text-indigo-650 text-4xl" />
              </div>

              <h3 className="text-lg font-black text-slate-800 mb-2">
                Password updated!
              </h3>
              <p className="text-slate-500 text-xs font-semibold mb-6 leading-relaxed max-w-[280px]">
                Your password has been reset successfully. Redirecting you to the workspace login...
              </p>

              <div className="w-full max-w-[240px]">
                <div className="w-full flex items-center justify-center gap-2 text-white bg-indigo-600 font-bold py-2.5 rounded-xl shadow-lg transition cursor-pointer text-xs uppercase tracking-widest">
                  Redirecting…
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </AuthLayout>
  );
};

export default ForgotPassword;
