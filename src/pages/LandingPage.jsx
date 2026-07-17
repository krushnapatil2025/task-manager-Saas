import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { DEFAULT_BRAND, applyCSSVariables } from '../context/BrandContext';
import SEO from '../components/SEO';
import {
  LuKanban, LuBell, LuShield, LuZap, LuUsers, LuChartBar,
  LuArrowRight, LuCheck, LuStar, LuMenu, LuX,
  LuClipboardCheck, LuFileUp, LuMessageSquare,
  LuChevronDown, LuChevronUp, LuPlay, LuPause, LuActivity,
  LuLock, LuGithub, LuTwitter, LuLinkedin, LuSparkles
} from 'react-icons/lu';

// ─────────────────────────────────────────────────────────────────────────────
// LandingPage — public marketing page (Enterprise Light Mode Theme)
// Route: /
// ─────────────────────────────────────────────────────────────────────────────

/* ─── Data ─────────────────────────────────────────────────────────────────── */
const FEATURES = [
  { icon: LuKanban,         color: 'from-blue-500 to-cyan-500',    title: 'Sprint Kanban Board',   desc: 'Drag-and-drop cards across custom columns with real-time status sync, sprint estimations, and interactive subtask checklists.' },
  { icon: LuBell,           color: 'from-purple-500 to-pink-500',  title: 'Real-time Notifications', desc: 'Instant in-app notification bell and OS-level push alerts when tasks are assigned or commented on.' },
  { icon: LuShield,         color: 'from-red-500 to-orange-500',   title: 'Enterprise Security & RLS', desc: 'Strict workspace tenant isolation, secure invitation workflows, audit logging, and Google OAuth security.' },
  { icon: LuUsers,          color: 'from-emerald-500 to-teal-500', title: 'Multi-Tenant Workspaces', desc: 'Create multiple isolated workspaces. Seamless team management with invite-only access roles.' },
  { icon: LuFileUp,         color: 'from-amber-500 to-yellow-500', title: 'Asset Storage & Sharing', desc: 'Upload documents, mockups, and spreadsheets directly to tasks with secure Supabase storage integration.' },
  { icon: LuChartBar,       color: 'from-cyan-500 to-blue-500',    title: 'Advanced Analytics',    desc: 'Sprint completion rate metrics, team velocity, priority breakdowns, and exportable high-fidelity Excel reports.' },
];

const PLANS = [
  {
    name:  'Free Starter',
    price: '₹0',
    sub:   'Forever',
    color: 'border-slate-200/85 hover:border-slate-350 hover:shadow-lg',
    badge: null,
    items: ['Up to 5 team members', '100 Active tasks limit', 'Basic analytics dashboard', 'Standard Kanban boards', '100 MB Storage limit'],
    cta:   { label: 'Get Started Free', to: '/admin/register', style: 'border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-xs' },
  },
  {
    name:  'Professional',
    price: '₹999',
    sub:   '/month',
    color: 'border-indigo-500 ring-2 ring-indigo-500/10 shadow-xl shadow-indigo-500/5 hover:border-indigo-650',
    badge: 'Most Popular',
    items: ['Up to 25 team members', 'Unlimited tasks & boards', 'Advanced analytics & charts', 'Real-time collaboration sync', '5 GB Secure storage', 'Priority customer support'],
    cta:   { label: 'Start 14-Day Trial', to: '/admin/register', style: 'bg-gradient-to-r from-indigo-600 to-violet-650 text-white hover:opacity-95 shadow-md shadow-indigo-600/10' },
  },
  {
    name:  'Enterprise Scale',
    price: '₹2,999',
    sub:   '/month',
    color: 'border-slate-200/85 hover:border-slate-350 hover:shadow-lg',
    badge: null,
    items: ['Unlimited team members', 'Unlimited storage & tasks', 'Custom analytics reports', 'Public Developer API access', 'Comprehensive Audit logs', 'Dedicated Account Manager'],
    cta:   { label: 'Contact Sales', to: '/admin/register', style: 'border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-xs' },
  },
];




const STEPS = [
  {
    num: '01',
    title: 'Initialize Workspace',
    desc: 'Register in seconds, set up your organization details, and establish your tenant workspace.'
  },
  {
    num: '02',
    title: 'Invite Collaborative Teams',
    desc: 'Share secure, invite-only links with developers, managers, or external stakeholders.'
  },
  {
    num: '03',
    title: 'Manage & Time Sprint Tasks',
    desc: 'Organize boards, start interactive timers on items, and chat dynamically on comments.'
  },
  {
    num: '04',
    title: 'Export & Audit Insights',
    desc: 'Download rich Excel summaries, analyze key velocity charts, and inspect admin audit logs.'
  }
];



const FAQS = [
  {
    q: 'How does team workspace isolation work?',
    a: 'Strideo uses Supabase Row-Level Security (RLS) policies at the database layer. Every select, update, or delete operation is filtered by the user session and workspace tenant ID. This ensures complete client isolation and zero data leakage.'
  },
  {
    q: 'Can we run active timers on tasks?',
    a: 'Absolutely! Our dashboard includes a running task timer module. You can start, pause, and log precise duration metrics for any assigned task, which automatically updates the sprint analytical charts.'
  },
  {
    q: 'What makes Strideo different from simple boards?',
    a: 'Unlike generic managers, Strideo features fully isolated multi-tenancy, built-in real-time team chats on specific tasks, custom time trackers, audit logs for compliance, and Excel exports out-of-the-box.'
  },
  {
    q: 'Can we configure Google OAuth for login?',
    a: 'Yes. Administrators can enable Google authentication in their workspace settings, allowing team members to sign in securely using corporate Google accounts.'
  }
];

/* ─── Component ─────────────────────────────────────────────────────────────── */
const LandingPage = () => {
  const [menuOpen,  setMenuOpen]  = useState(false);
  const [scrolled,  setScrolled]  = useState(false);
  const [activeFaq, setActiveFaq] = useState(null);
  const [timerRunning, setTimerRunning] = useState(true);
  const [timerSeconds, setTimerSeconds] = useState(142); // 2m 22s initial

  useEffect(() => {
    applyCSSVariables(DEFAULT_BRAND);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    let interval = null;
    if (timerRunning) {
      interval = setInterval(() => {
        setTimerSeconds((s) => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerRunning]);

  const formatTime = (totalSecs) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const companyName = 'Strideo';

  return (
    <div className="bg-slate-50/50 text-slate-800 min-h-screen overflow-x-hidden font-sans antialiased selection:bg-indigo-150 selection:text-indigo-950">
      <SEO 
        title="Collaborate Effortlessly & Ship Projects Faster" 
        description="Strideo is an enterprise-grade multi-tenant task manager featuring real-time Kanban boards, time tracking, chat, and analytics."
        keywords="task manager, enterprise task manager, saas board, kanban board, sprint planning, team chat, time tracking"
        canonical="/"
      />

      {/* ══════════════════════ NAVBAR ══════════════════════════════════════ */}
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/85 backdrop-blur-xl border-b border-slate-200/60 shadow-sm' : 'bg-transparent'}`}>
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-16">
          <Link to="/" className="text-lg font-black tracking-tight flex items-center gap-2 select-none hover:opacity-85 transition-opacity">
            <img src="/logo.png" className="w-7 h-7 object-contain rounded-lg shadow-sm" alt="Logo" />
            <span className="text-slate-900 font-extrabold">{companyName}</span>
          </Link>

          <div className="hidden md:flex items-center gap-8 text-xs font-bold text-slate-500">
            {['Features', 'How it Works', 'Pricing', 'FAQ'].map((s) => (
              <a key={s} href={`#${s.toLowerCase().replace(/\s+/g, '-')}`} className="hover:text-indigo-600 transition-colors">{s}</a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link to="/login" className="text-xs font-bold text-slate-600 hover:text-indigo-650 transition px-4 py-2">Login</Link>
            <Link to="/admin/register" className="text-xs font-extrabold bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl transition shadow-sm hover:shadow-md">
              Create Workspace
            </Link>
          </div>

          <button className="md:hidden text-slate-500 hover:text-slate-800 p-1 rounded-lg" onClick={() => setMenuOpen((o) => !o)}>
            {menuOpen ? <LuX className="text-xl" /> : <LuMenu className="text-xl" />}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden bg-white border-t border-slate-100 px-6 py-4 space-y-3 shadow-lg">
            {['features', 'how-it-works', 'pricing', 'faq'].map((s) => (
              <a key={s} href={`#${s}`} className="block text-xs font-bold capitalize text-slate-600 hover:text-indigo-650 py-1" onClick={() => setMenuOpen(false)}>{s.replace(/-/g, ' ')}</a>
            ))}
            <div className="flex gap-3 pt-3 border-t border-slate-100">
              <Link to="/login" className="flex-1 text-center text-xs border border-slate-200 text-slate-700 rounded-xl py-2.5 hover:bg-slate-50 transition font-bold">Login</Link>
              <Link to="/admin/register" className="flex-1 text-center text-xs bg-indigo-650 text-white rounded-xl py-2.5 transition font-bold">Sign Up</Link>
            </div>
          </div>
        )}
      </nav>

      {/* ══════════════════════ HERO ════════════════════════════════════════ */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 pt-32 pb-20 overflow-hidden bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px]">
        {/* Background decorative glows */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-violet-500/5 rounded-full blur-3xl" />
        </div>

        {/* Badge */}
        <div className="inline-flex items-center gap-2 text-xs font-bold text-indigo-700 bg-indigo-50/80 border border-indigo-100/50 px-4 py-1.5 rounded-full mb-8 animate-fade-in shadow-sm">
          <LuZap className="text-amber-500" /> Now with Supabase Realtime · Multi-tenant RLS
        </div>

        <h1 className="text-4xl md:text-6xl font-black leading-[1.1] text-slate-900 mb-6 tracking-tight max-w-4xl animate-fade-in"
          style={{ animationDelay: '0.1s' }}>
          Collaborate Effortlessly.<br />
          <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-700 bg-clip-text text-transparent">
            Ship Projects Faster.
          </span>
        </h1>

        <p className="text-sm md:text-base text-slate-500 max-w-2xl mb-10 leading-relaxed font-medium animate-fade-in" style={{ animationDelay: '0.2s' }}>
          Enterprise-grade workspace management, robust Kanban progress trackers, real-time collaboration widgets, audit logs, and complete data tenant isolation built for modern companies.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <Link
            to="/admin/register"
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-750 text-white font-bold px-8 py-4 rounded-2xl text-xs shadow-md transition-all duration-200 hover:-translate-y-0.5"
          >
            Create Your Workspace <LuArrowRight />
          </Link>
          <Link
            to="/login"
            className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:border-slate-350 px-7 py-4 rounded-2xl transition hover:shadow-sm"
          >
            Sign In to Dashboard
          </Link>
        </div>

        <p className="text-[10px] text-slate-400 mt-5 font-bold">No credit card required · Free plan included</p>

        {/* Mock UI preview */}
        <div className="relative mt-20 w-full max-w-5xl animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <div className="absolute -inset-1.5 bg-gradient-to-r from-indigo-500/10 to-violet-500/10 rounded-3xl blur-2xl opacity-75" />
          <div className="relative bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xl flex text-left h-[480px]">
            {/* Sidebar (App mock-up) */}
            <div className="w-16 md:w-48 bg-slate-50 border-r border-slate-150 p-4 flex flex-col justify-between shrink-0 select-none">
              <div className="space-y-6">
                {/* Logo */}
                <div className="flex items-center gap-2 px-2">
                  <span className="w-2.5 h-4.5 bg-gradient-to-b from-indigo-500 to-violet-650 rounded-sm inline-block shrink-0"></span>
                  <span className="hidden md:inline text-xs font-black tracking-wide text-slate-855">{companyName}</span>
                </div>
                {/* Menu items */}
                <div className="space-y-1">
                  {[
                    { label: 'Dashboard', active: false },
                    { label: 'Kanban Board', active: true },
                    { label: 'Calendar', active: false },
                    { label: 'Team Members', active: false },
                    { label: 'Analytics', active: false },
                  ].map((m, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-extrabold transition-all duration-150 ${
                        m.active 
                          ? 'bg-indigo-55 text-indigo-700 border-l-2 border-indigo-600 rounded-l-none' 
                          : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
                      }`}
                    >
                      <div className={`w-1 h-1 rounded-full ${m.active ? 'bg-indigo-600' : 'bg-transparent'}`} />
                      <span className="hidden md:inline">{m.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="hidden md:flex items-center gap-2 px-2 text-[10px] text-slate-400 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span> Live sync active
              </div>
            </div>

            {/* Main area (App mock-up) */}
            <div className="flex-grow bg-[#fafbfd] flex flex-col min-w-0">
              {/* Fake App Navbar */}
              <div className="h-12 border-b border-slate-150/70 bg-white px-6 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400">
                  <span>Product Dev</span>
                  <span className="text-slate-350">/</span>
                  <span className="text-slate-650">Kanban Board</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100/60 rounded-lg py-1 px-2.5">
                    <button 
                      onClick={() => setTimerRunning(!timerRunning)}
                      className="text-[10px] text-indigo-750 hover:scale-110 transition flex items-center justify-center p-0.5 bg-white shadow-xs rounded-full cursor-pointer"
                    >
                      {timerRunning ? <LuPause className="text-[8px]" /> : <LuPlay className="text-[8px] fill-indigo-700" />}
                    </button>
                    <span className="text-[10px] font-mono font-black text-indigo-700">{formatTime(timerSeconds)}</span>
                    <span className="text-[9px] text-indigo-500 font-bold hidden sm:inline">Active Timer</span>
                  </div>
                  <div className="w-6 h-6 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[9px] text-indigo-700 font-black">
                    KS
                  </div>
                </div>
              </div>

              {/* Fake Kanban View */}
              <div className="flex-1 p-5 overflow-hidden grid grid-cols-3 gap-4">
                {[
                  {
                    col: 'Planned',
                    badge: '2',
                    cards: [
                      { title: 'Redesign billing interface', priority: 'High', prColor: 'bg-rose-50 text-rose-600 border-rose-100', tag: 'UIUX', comments: 4 },
                      { title: 'Write API endpoints docs', priority: 'Medium', prColor: 'bg-amber-50 text-amber-600 border-amber-100', tag: 'Docs', comments: 1 }
                    ]
                  },
                  {
                    col: 'In Progress',
                    badge: '1',
                    cards: [
                      { title: 'Supabase real-time triggers', priority: 'High', prColor: 'bg-rose-50 text-rose-600 border-rose-100', tag: 'Backend', comments: 8, active: true }
                    ]
                  },
                  {
                    col: 'Completed',
                    badge: '4',
                    cards: [
                      { title: 'Workspace tenant RLS rules', priority: 'High', prColor: 'bg-emerald-50 text-emerald-600 border-emerald-100', tag: 'Security', comments: 12 },
                      { title: 'Google OAuth registration', priority: 'Low', prColor: 'bg-indigo-50 text-indigo-600 border-indigo-100', tag: 'Auth', comments: 0 }
                    ]
                  }
                ].map((column) => (
                  <div key={column.col} className="flex flex-col min-w-0 select-none">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{column.col}</span>
                      <span className="text-[9px] font-bold text-slate-500 bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded-md">{column.badge}</span>
                    </div>

                    <div className="space-y-3 overflow-hidden flex-grow">
                      {column.cards.map((card, i) => (
                        <div
                          key={i}
                          className={`bg-white border rounded-2xl p-3.5 shadow-sm transition-all duration-200 group/card cursor-pointer ${
                            card.active 
                              ? 'border-indigo-450 ring-2 ring-indigo-500/5 shadow-indigo-100/50 bg-indigo-25/10' 
                              : 'border-slate-200 hover:border-slate-350 hover:shadow-md'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded border ${card.prColor}`}>
                              {card.priority}
                            </span>
                            <span className="text-[9px] font-bold text-slate-400 bg-slate-50 border border-slate-200/60 px-2 py-0.5 rounded">
                              {card.tag}
                            </span>
                            {card.active && (
                              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                            )}
                          </div>
                          
                          <p className="text-[11px] font-bold text-slate-800 leading-snug mb-3 group-hover/card:text-indigo-650 transition-colors">
                            {card.title}
                          </p>
                          
                          <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[9px] text-slate-400 font-bold">
                            <div className="flex items-center gap-1">
                              <span>💬 {card.comments}</span>
                            </div>
                            <div className="flex -space-x-1.5">
                              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 border border-white flex items-center justify-center text-[7px] text-white font-extrabold">A</div>
                              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 border border-white flex items-center justify-center text-[7px] text-white font-extrabold">B</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* ══════════════════════ FEATURES ════════════════════════════════════ */}
      <section id="features" className="py-28 px-6 bg-slate-50/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-3">Enterprise Suite</p>
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Built for modern collaborative teams</h2>
            <p className="text-slate-500 mt-4 max-w-xl mx-auto text-sm font-medium leading-relaxed">
              Experience the best features, structured with row-level workspace separation and responsive layout logic.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="bg-white border border-slate-200/80 rounded-2xl p-7 hover:border-slate-350 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group"
              >
                <div className={`w-11 h-11 rounded-2xl bg-indigo-55/40 flex items-center justify-center mb-5`}>
                  <f.icon className="text-indigo-600 text-lg" />
                </div>
                <h3 className="font-bold text-slate-800 text-base mb-2.5">{f.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════ HOW IT WORKS ═════════════════════════════════ */}
      <section id="how-it-works" className="py-28 px-6 bg-white border-t border-slate-100">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <p className="text-xs font-black text-indigo-650 uppercase tracking-widest mb-3">Workflow Execution</p>
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">How Strideo drives productivity</h2>
            <p className="text-slate-500 mt-4 max-w-xl mx-auto text-sm font-medium leading-relaxed">
              Four simple phases to align team timelines, tracking accuracy, and enterprise visibility.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
            {/* Connecting lines for desktop */}
            <div className="hidden md:block absolute top-1/2 left-[12%] right-[12%] h-[1px] bg-slate-200 -translate-y-12 z-0" />
            
            {STEPS.map((step, idx) => (
              <div key={step.num} className="relative z-10 flex flex-col items-center text-center bg-[#fafbfd] border border-slate-200/60 rounded-3xl p-6.5 hover:shadow-lg transition-all duration-300">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-md shadow-indigo-650/15 mb-6">
                  {step.num}
                </div>
                <h3 className="font-extrabold text-slate-900 text-sm mb-2.5">{step.title}</h3>
                <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>



      {/* ══════════════════════ PRICING ═════════════════════════════════════ */}
      <section id="pricing" className="py-28 px-6 bg-white border-t border-slate-100">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-3">Transparent Plans</p>
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Start free, scale seamlessly</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`relative bg-white border rounded-3xl p-8 flex flex-col hover:shadow-lg transition-all duration-300 ${plan.color}`}
              >
                {plan.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-[9px] font-black text-white bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-1.5 rounded-full uppercase tracking-wider">
                    {plan.badge}
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="font-black text-slate-800 text-base">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mt-2.5">
                    <span className="text-3xl font-extrabold text-slate-900">{plan.price}</span>
                    <span className="text-slate-400 text-xs font-bold">{plan.sub}</span>
                  </div>
                </div>

                <ul className="space-y-3.5 flex-1 mb-8">
                  {plan.items.map((item) => (
                    <li key={item} className="flex items-center gap-3 text-xs font-bold text-slate-650">
                      <LuCheck className="text-emerald-500 flex-shrink-0 text-sm" />
                      {item}
                    </li>
                  ))}
                </ul>

                <Link
                  to={plan.cta.to}
                  className={`block text-center font-bold py-3.5 rounded-2xl transition text-xs ${plan.cta.style}`}
                >
                  {plan.cta.label}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>



      {/* ══════════════════════ FAQ SECTION ═══════════════════════════════════ */}
      <section id="faq" className="py-28 px-6 bg-[#fafbfd] border-t border-slate-150/70">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-black text-indigo-650 uppercase tracking-widest mb-3">Common Questions</p>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Frequently Asked Queries</h2>
          </div>

          <div className="space-y-4">
            {FAQS.map((faq, idx) => {
              const isOpen = activeFaq === idx;
              return (
                <div key={idx} className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden transition-all duration-200">
                  <button 
                    onClick={() => setActiveFaq(isOpen ? null : idx)}
                    className="w-full flex items-center justify-between p-6 text-left font-bold text-slate-800 text-xs md:text-sm hover:text-indigo-650 transition-colors"
                  >
                    <span>{faq.q}</span>
                    {isOpen ? <LuChevronUp className="text-slate-450" /> : <LuChevronDown className="text-slate-450" />}
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-6 text-xs text-slate-500 font-semibold leading-relaxed border-t border-slate-100 pt-4 animate-fade-in">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════ CTA ══════════════════════════════════════════ */}
      <section className="py-24 px-6 bg-white border-t border-slate-100">
        <div className="max-w-4xl mx-auto">
          <div className="relative bg-gradient-to-br from-slate-900 to-indigo-950 rounded-[32px] p-16 shadow-2xl text-center text-white overflow-hidden border border-slate-800">
            {/* Mesh glows in CTA */}
            <div className="absolute inset-0 pointer-events-none opacity-20">
              <div className="absolute -top-12 -left-12 w-64 h-64 bg-indigo-400 rounded-full blur-2xl" />
              <div className="absolute -bottom-12 -right-12 w-64 h-64 bg-violet-400 rounded-full blur-2xl" />
            </div>
            <div className="relative">
              <h2 className="text-3xl md:text-4xl font-black mb-4 tracking-tight">Ready to boost team efficiency?</h2>
              <p className="text-indigo-200 mb-8 max-w-md mx-auto text-xs md:text-sm leading-relaxed font-semibold">
                Join thousands of organizations using {companyName} to structure workspace sprint iterations and track active time.
              </p>
              <Link
                to="/admin/register"
                className="inline-flex items-center gap-2 bg-indigo-605 hover:bg-indigo-700 text-white font-bold px-8 py-4 rounded-2xl text-xs shadow-xl hover:scale-105 transition-all duration-200 cursor-pointer"
              >
                Create Free Workspace <LuArrowRight />
              </Link>
              <p className="text-[10px] text-indigo-300/80 mt-4 font-bold">Free forever tier · Setup under 2 minutes</p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════ FOOTER ═══════════════════════════════════════ */}
      <footer className="bg-slate-900 text-slate-400 pt-20 pb-10 px-6 border-t border-slate-800">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-5 gap-12 mb-16">
          <div className="md:col-span-2 space-y-6">
            <Link to="/" className="text-lg font-black text-white flex items-center gap-2 select-none hover:opacity-85 transition-opacity inline-flex">
              <img src="/logo.png" className="w-8 h-8 object-contain rounded-lg shadow-lg" alt="Logo" />
              <span className="tracking-tight text-white">{companyName}</span>
            </Link>
            <p className="text-xs text-slate-400 max-w-xs leading-relaxed font-semibold">
              The ultimate high-performance workspace for agile teams. Organize tasks, track time logs, and collaborate in real-time.
            </p>
            <div className="flex gap-4">
              <a href="#" className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-white hover:bg-indigo-600 transition-colors"><LuTwitter className="text-xs" /></a>
              <a href="#" className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-white hover:bg-indigo-600 transition-colors"><LuGithub className="text-xs" /></a>
              <a href="#" className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-white hover:bg-indigo-600 transition-colors"><LuLinkedin className="text-xs" /></a>
            </div>
          </div>
          
          <div>
            <h4 className="text-white text-[10px] font-extrabold uppercase tracking-widest mb-4">Product</h4>
            <ul className="space-y-2.5 text-xs font-semibold">
              <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
              <li><a href="#how-it-works" className="hover:text-white transition-colors">How it Works</a></li>
              <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
              <li><Link to="/login" className="hover:text-white transition-colors">Workspace Login</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-white text-[10px] font-extrabold uppercase tracking-widest mb-4">Resources</h4>
            <ul className="space-y-2.5 text-xs font-semibold">
              <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
              <li><a href="#" className="hover:text-white transition-colors">API Reference</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Changelog</a></li>
              <li><a href="#" className="hover:text-white transition-colors">System Status</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white text-[10px] font-extrabold uppercase tracking-widest mb-4">Security</h4>
            <ul className="space-y-2.5 text-xs font-semibold">
              <li><a href="#" className="hover:text-white transition-colors">Data Privacy</a></li>
              <li><a href="#" className="hover:text-white transition-colors">RLS Policies</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Security Audits</a></li>
            </ul>
          </div>
        </div>
        
        <div className="max-w-6xl mx-auto pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-semibold">
          <p>© 2026 strideo . All rights reserved.</p>
          <p>Built by <a href="https://www.cicdtech.in/" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 hover:underline">CICD Tech</a></p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Compliance SLA</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
