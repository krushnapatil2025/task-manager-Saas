import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  LuKanban, LuBell, LuShield, LuZap, LuUsers, LuChartBar,
  LuArrowRight, LuCheck, LuStar, LuMenu, LuX,
  LuClipboardCheck, LuFileUp, LuMessageSquare,
} from 'react-icons/lu';
// ─────────────────────────────────────────────────────────────────────────────
// LandingPage — public marketing page (Enterprise Light Mode Theme)
// Route: /
// ─────────────────────────────────────────────────────────────────────────────

/* ─── Data ─────────────────────────────────────────────────────────────────── */
const FEATURES = [
  { icon: LuKanban,         color: 'from-blue-500 to-cyan-500',    title: 'Kanban Board',          desc: 'Drag-and-drop cards across Pending, In Progress, and Completed columns with real-time status sync.' },
  { icon: LuBell,           color: 'from-purple-500 to-pink-500',  title: 'Live Notifications',    desc: 'Instant in-app alerts when tasks are assigned, commented on, or completed — powered by Supabase Realtime.' },
  { icon: LuShield,         color: 'from-red-500 to-orange-500',   title: 'Enterprise Security',   desc: 'Row-level security, invite-only workspaces, audit logs, Google OAuth, and CSP headers out of the box.' },
  { icon: LuUsers,          color: 'from-emerald-500 to-teal-500', title: 'Multi-Tenant Workspaces', desc: 'Every team gets a fully isolated workspace. Zero data leakage between tenants — enforced at database level.' },
  { icon: LuFileUp,         color: 'from-amber-500 to-yellow-500', title: 'File Attachments',      desc: 'Upload PDFs, images, and documents directly to tasks. Stored securely on Supabase Storage.' },
  { icon: LuChartBar,       color: 'from-cyan-500 to-blue-500',    title: 'Analytics Dashboard',   desc: 'Completion rates, priority breakdowns, team productivity charts, and exportable Excel reports.' },
];

const PLANS = [
  {
    name:  'Free',
    price: '₹0',
    sub:   'Forever',
    color: 'border-slate-200/80 hover:border-slate-300',
    badge: null,
    items: ['5 members', '100 tasks', 'Basic charts', 'Kanban board', '100 MB storage'],
    cta:   { label: 'Start Free', to: '/admin/register', style: 'border border-slate-250 hover:bg-slate-50 text-slate-700' },
  },
  {
    name:  'Pro',
    price: '₹999',
    sub:   '/month',
    color: 'border-indigo-500/80 shadow-xl shadow-indigo-500/5 hover:border-indigo-600',
    badge: 'Most Popular',
    items: ['25 members', 'Unlimited tasks', 'Advanced analytics', 'Real-time sync', 'File uploads 5 GB', 'Priority support'],
    cta:   { label: 'Start Pro Trial', to: '/admin/register', style: 'bg-gradient-to-r from-indigo-650 to-violet-650 text-white hover:opacity-95 shadow-md shadow-indigo-600/10' },
  },
  {
    name:  'Enterprise',
    price: '₹2,999',
    sub:   '/month',
    color: 'border-slate-200/80 hover:border-slate-300',
    badge: null,
    items: ['Unlimited members', 'Unlimited everything', 'Custom reports', 'Public API access', 'Audit logs', 'Dedicated support'],
    cta:   { label: 'Contact Sales', to: '/admin/register', style: 'border border-slate-250 hover:bg-slate-50 text-slate-700' },
  },
];

const TESTIMONIALS = [
  { name: 'Rahul Sharma',   role: 'CTO, TechStartup',     avatar: 'RS', text: 'TaskFlow replaced Jira for our 20-person team. The Kanban board and real-time updates are buttery smooth.',    stars: 5 },
  { name: 'Priya Nair',     role: 'Product Manager, EdTech', avatar: 'PN', text: 'Workspace isolation is a game-changer. Each client team sees only their data. Supabase RLS is doing the heavy lifting.', stars: 5 },
  { name: 'Arjun Mehta',    role: 'Engineering Lead',      avatar: 'AM', text: 'The audit log caught a rogue admin action immediately. The security hardening in Phase 4 is enterprise-grade.',   stars: 5 },
];

const STATS = [
  { value: '10K+',  label: 'Tasks Completed'   },
  { value: '500+',  label: 'Active Workspaces'  },
  { value: '99.9%', label: 'Uptime SLA'         },
  { value: '<50ms', label: 'Realtime Latency'   },
];

/* ─── Component ─────────────────────────────────────────────────────────────── */
const LandingPage = () => {
  const [menuOpen,  setMenuOpen]  = useState(false);
  const [scrolled,  setScrolled]  = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const companyName = 'TaskFlow';

  return (
    <div className="bg-[#fafbfd] text-slate-800 min-h-screen overflow-x-hidden font-sans antialiased selection:bg-indigo-100 selection:text-indigo-900">

      {/* ══════════════════════ NAVBAR ══════════════════════════════════════ */}
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/85 backdrop-blur-xl border-b border-slate-200/60 shadow-sm' : 'bg-transparent'}`}>
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-16">
          <span className="text-lg font-black tracking-tight flex items-center gap-2 select-none">
            <span 
              className="w-7 h-7 rounded-lg flex items-center justify-center shadow-sm text-white font-black text-xs bg-gradient-to-br from-indigo-500 to-violet-650"
            >
              T
            </span>
            <span className="text-slate-900 font-extrabold">{companyName}</span>
          </span>

          <div className="hidden md:flex items-center gap-8 text-xs font-bold text-slate-500">
            {['Features', 'Pricing', 'Testimonials'].map((s) => (
              <a key={s} href={`#${s.toLowerCase()}`} className="hover:text-slate-900 transition-colors">{s}</a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link to="/login" className="text-xs font-bold text-slate-600 hover:text-slate-900 transition px-4 py-2">Login</Link>
            <Link to="/admin/register" className="text-xs font-extrabold bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl transition shadow-sm hover:shadow-md">
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
            {['features', 'pricing', 'testimonials'].map((s) => (
              <a key={s} href={`#${s}`} className="block text-xs font-bold capitalize text-slate-600 hover:text-slate-900 py-1" onClick={() => setMenuOpen(false)}>{s}</a>
            ))}
            <div className="flex gap-3 pt-3 border-t border-slate-100">
              <Link to="/login" className="flex-1 text-center text-xs border border-slate-200 text-slate-700 rounded-xl py-2.5 hover:bg-slate-50 transition font-bold">Login</Link>
              <Link to="/admin/register" className="flex-1 text-center text-xs bg-slate-900 hover:bg-slate-850 text-white rounded-xl py-2.5 transition font-bold">Sign Up</Link>
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
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold px-8 py-4 rounded-2xl text-xs shadow-md transition-all duration-200 hover:-translate-y-0.5"
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
                  <span className="w-2.5 h-4.5 bg-gradient-to-b from-indigo-500 to-violet-600 rounded-sm inline-block shrink-0"></span>
                  <span className="hidden md:inline text-xs font-black tracking-wide text-slate-850">{companyName}</span>
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
                          ? 'bg-indigo-50 text-indigo-700 border-l-2 border-indigo-600 rounded-l-none' 
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
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Live updates active
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
                  <div className="hidden sm:block text-[9px] text-slate-400 bg-slate-50 px-2.5 py-1 rounded border border-slate-200/80 font-mono font-bold">
                    Ctrl+K to search
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
                      <span className="text-[10px] font-extrabold text-slate-450 uppercase tracking-wider">{column.col}</span>
                      <span className="text-[9px] font-bold text-slate-550 bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded-md">{column.badge}</span>
                    </div>

                    <div className="space-y-3 overflow-hidden flex-grow">
                      {column.cards.map((card, i) => (
                        <div
                          key={i}
                          className={`bg-white border rounded-2xl p-3.5 shadow-sm transition-all duration-200 group/card cursor-pointer ${
                            card.active 
                              ? 'border-indigo-400 ring-2 ring-indigo-500/5 shadow-indigo-100/50 bg-indigo-25/10' 
                              : 'border-slate-200 hover:border-slate-300 hover:shadow'
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

      {/* ══════════════════════ STATS ════════════════════════════════════════ */}
      <section className="py-20 border-y border-slate-200/70 bg-white">
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {STATS.map((s) => (
            <div key={s.label}>
              <p className="text-4xl font-black bg-gradient-to-r from-indigo-600 to-indigo-755 bg-clip-text text-transparent">{s.value}</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-2.5">{s.label}</p>
            </div>
          ))}
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

      {/* ══════════════════════ TESTIMONIALS ════════════════════════════════ */}
      <section id="testimonials" className="py-28 px-6 bg-[#fafbfd] border-t border-slate-150/70">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-3">Customer Success</p>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Loved by high-performing teams</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="bg-white border border-slate-200/80 rounded-3xl p-8 hover:shadow-md transition-all duration-300">
                <div className="flex gap-0.5 mb-5">
                  {Array.from({ length: t.stars }).map((_, i) => (
                    <LuStar key={i} className="text-amber-400 text-xs fill-amber-400" />
                  ))}
                </div>
                <p className="text-xs font-medium text-slate-600 leading-relaxed mb-6">"{t.text}"</p>
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0 text-indigo-600 font-extrabold text-xs shadow-sm">
                    {t.avatar}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">{t.name}</p>
                    <p className="text-[10px] font-bold text-slate-400 mt-0.5">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════ CTA ══════════════════════════════════════════ */}
      <section className="py-24 px-6 bg-white border-t border-slate-100">
        <div className="max-w-4xl mx-auto">
          <div className="relative bg-gradient-to-br from-indigo-900 to-violet-900 rounded-[32px] p-16 shadow-2xl text-center text-white overflow-hidden">
            {/* Mesh glows in CTA */}
            <div className="absolute inset-0 pointer-events-none opacity-20">
              <div className="absolute -top-12 -left-12 w-64 h-64 bg-indigo-400 rounded-full blur-2xl" />
              <div className="absolute -bottom-12 -right-12 w-64 h-64 bg-violet-400 rounded-full blur-2xl" />
            </div>
            <div className="relative">
              <h2 className="text-3xl md:text-4xl font-black mb-4 tracking-tight">Ready to boost team efficiency?</h2>
              <p className="text-indigo-200 mb-8 max-w-md mx-auto text-sm leading-relaxed font-semibold">
                Join thousands of teams using {companyName} to structure workspace tasks and track time.
              </p>
              <Link
                to="/admin/register"
                className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-indigo-950 font-black px-8 py-4 rounded-2xl text-xs shadow-xl hover:scale-105 transition-all duration-200"
              >
                Create Free Workspace <LuArrowRight />
              </Link>
              <p className="text-[10px] text-indigo-300/80 mt-4 font-bold">Free forever tier · Create in 2 minutes</p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════ FOOTER ═══════════════════════════════════════ */}
      <footer className="bg-slate-50 border-t border-slate-200/80 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <span className="text-xs font-black flex items-center gap-2 select-none">
            <span 
              className="w-5 h-5 rounded flex items-center justify-center shadow-xs text-white font-black text-[9px] bg-gradient-to-br from-indigo-500 to-violet-650"
            >
              T
            </span>
            <span className="text-slate-800 font-extrabold">{companyName}</span>
            <span className="text-slate-400 font-bold ml-2">© {new Date().getFullYear()}</span>
          </span>
          <div className="flex items-center gap-6 text-xs font-bold text-slate-500">
            <Link to="/login"  className="hover:text-slate-900 transition-colors">Login</Link>
            <Link to="/admin/register" className="hover:text-slate-900 transition-colors">Sign Up</Link>
            <a href="#features" className="hover:text-slate-900 transition-colors">Features</a>
            <a href="#pricing"  className="hover:text-slate-900 transition-colors">Pricing</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
