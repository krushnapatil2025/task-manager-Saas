import React from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLayout from '../../components/layouts/AuthLAyout';
import { LuClock, LuMail, LuCircleCheck, LuArrowRight } from 'react-icons/lu';

const RegistrationPending = () => {
  const navigate = useNavigate();

  return (
    <AuthLayout
      title="Registration Submitted"
      subtitle="Your enterprise workspace is undergoing review"
    >
      <div className="flex flex-col items-center text-center py-4">
        {/* Animated Hourglass/Clock Icon */}
        <div className="relative mb-6">
          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 shadow-sm border border-amber-100">
            <LuClock className="text-3xl animate-pulse" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center text-white text-[9px] font-bold shadow-sm">
            i
          </div>
        </div>

        <h3 className="text-slate-800 font-extrabold text-sm mb-2">Awaiting Super Admin Approval</h3>
        <p className="text-slate-500 text-xs font-medium leading-relaxed max-w-sm mb-6">
          Thank you for choosing <strong>Strideo</strong>! Your request to register a company workspace is now in our queue. A Super Admin will review your company details and verify the setup shortly.
        </p>

        {/* Process steps */}
        <div className="w-full text-left space-y-3 mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-100">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">What to expect</span>

          <div className="flex gap-2.5 items-start">
            <LuCircleCheck className="text-green-500 text-sm mt-0.5 flex-shrink-0" />
            <div className="text-[11px] font-semibold text-slate-600">
              <strong className="text-slate-800 font-black">Step 1: Admin Review</strong>
              <p className="text-slate-500 font-medium">We verify details like company name, email domain, and size.</p>
            </div>
          </div>

          <div className="flex gap-2.5 items-start">
            <LuMail className="text-indigo-650 text-sm mt-0.5 flex-shrink-0" />
            <div className="text-[11px] font-semibold text-slate-600">
              <strong className="text-slate-800 font-black">Step 2: Email Notification</strong>
              <p className="text-slate-500 font-medium">You will receive a branded email once your workspace is approved or restricted.</p>
            </div>
          </div>
        </div>

        {/* Contact/Support Note */}
        <p className="text-[10px] text-slate-400 font-bold mb-6">
          If you have questions, please reach out to <a href="mailto:support@Strideo.com" className="text-indigo-650 hover:underline">support@Strideo.com</a>
        </p>

        {/* Action Button */}
        <button
          onClick={() => navigate('/login')}
          className="w-full bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-xl text-xs font-semibold shadow flex items-center justify-center gap-1.5 cursor-pointer transition"
        >
          Go to Sign In <LuArrowRight size={13} />
        </button>
      </div>
    </AuthLayout>
  );
};

export default RegistrationPending;
