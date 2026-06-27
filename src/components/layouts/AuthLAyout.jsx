import React from 'react';
import { LuCircleCheck } from 'react-icons/lu';
const AuthLayout = ({ children, title = "Sign In", subtitle = "Access your workspace dashboard" }) => {
  const companyName = 'TaskFlow';

  return (
    <div className="flex min-h-screen bg-[#fafbfd] font-sans antialiased">
      {/* ── Left side: Brand Showcase (Hidden on small screens) ── */}
      <div className="hidden md:flex md:w-[40%] bg-[#0c0c0e] flex-col justify-between p-12 relative overflow-hidden border-r border-zinc-900 select-none shrink-0">
        {/* Decorative Grid Pattern */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[radial-gradient(rgba(255,255,255,0.15)_1px,transparent_1px)] bg-[size:16px_16px]" />
        <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] bg-indigo-650/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Branding Logo */}
        <div className="relative z-10">
          <span className="text-xs font-black tracking-tight flex items-center gap-2 text-white">
            <span 
              className="w-6 h-6 rounded flex items-center justify-center text-white font-black text-[10px] bg-gradient-to-br from-indigo-500 to-violet-650"
            >
              T
            </span>
            <span>{companyName}</span>
          </span>
        </div>

        {/* Core Value Pitch */}
        <div className="relative z-10 my-auto pr-6">
          <h1 className="text-2xl font-black text-neutral-100 tracking-tight leading-tight mb-6">
            The workspace for<br />
            high-performance teams.
          </h1>
          
          <ul className="space-y-4">
            {[
              "Enterprise-grade Workspace Isolation",
              "Real-time WebSocket Collaboration",
              "Integrations, Automations & Audit Logs",
              "Groq Llama 3 AI Task Co-Pilot"
            ].map((text, idx) => (
              <li key={idx} className="flex items-center gap-2.5 text-xs font-semibold text-neutral-400">
                <LuCircleCheck className="text-indigo-500 text-sm flex-shrink-0" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer info */}
        <div className="relative z-10 text-[10px] text-neutral-500 font-bold">
          {companyName} Enterprise · Trusted by teams worldwide.
        </div>
      </div>

      {/* ── Right side: Actionable Form ── */}
      <div className="w-full md:w-[60%] flex flex-col justify-center items-center px-6 py-12 bg-slate-50">
        <div className="w-full max-w-[420px] bg-white border border-slate-250/70 shadow-xl shadow-slate-100/50 rounded-3xl p-8 md:p-10">
          
          {/* Mobile Header Branding (Hidden on desktop) */}
          <div className="md:hidden flex items-center gap-2 mb-6 select-none justify-center">
            <span 
              className="w-6 h-6 rounded flex items-center justify-center text-white font-black text-[10px] bg-gradient-to-br from-indigo-500 to-violet-650"
            >
              T
            </span>
            <span className="text-xs font-black text-slate-800">{companyName}</span>
          </div>

          <div className="mb-6 text-center">
            <h2 className="text-base font-black text-slate-900 tracking-tight">{title}</h2>
            <p className="text-xs font-semibold text-slate-450 mt-1">{subtitle}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;