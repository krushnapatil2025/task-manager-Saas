import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  LuKanban, LuBell, LuShield, LuZap, LuUsers, LuChartBar,
  LuArrowRight, LuCheck, LuStar, LuGithub, LuMenu, LuX,
  LuClipboardCheck, LuFileUp, LuMessageSquare,
} from 'react-icons/lu';

// ─────────────────────────────────────────────────────────────────────────────
// LandingPage — public marketing page
// Route: /
// ─────────────────────────────────────────────────────────────────────────────

/* ─── Data ─────────────────────────────────────────────────────────────────── */
const FEATURES = [
  { icon: LuKanban,         color: 'from-blue-500 to-cyan-500',    title: 'Kanban Board',          desc: 'Drag-and-drop cards across Pending, In Progress, and Completed columns with real-time sync.' },
  { icon: LuBell,           color: 'from-purple-500 to-pink-500',  title: 'Live Notifications',    desc: 'Instant in-app alerts when tasks are assigned, commented on, or status changes — powered by Supabase Realtime.' },
  { icon: LuShield,         color: 'from-red-500 to-orange-500',   title: 'Enterprise Security',   desc: 'Row-level security, invite-only workspaces, audit logs, Google OAuth, and CSP headers out of the box.' },
  { icon: LuUsers,          color: 'from-lime-500 to-emerald-500', title: 'Multi-Tenant Workspaces', desc: 'Every team gets a fully isolated workspace. Zero data leakage between tenants — enforced at the database level.' },
  { icon: LuFileUp,         color: 'from-amber-500 to-yellow-400', title: 'File Attachments',      desc: 'Upload PDFs, images, and documents directly to tasks. Stored securely on Supabase Storage with access control.' },
  { icon: LuChartBar,      color: 'from-cyan-500 to-blue-500',    title: 'Analytics Dashboard',   desc: 'Completion rates, priority breakdowns, team productivity charts, and exportable Excel reports at a glance.' },
];

const PLANS = [
  {
    name:  'Free',
    price: '₹0',
    sub:   'Forever',
    color: 'border-slate-800',
    badge: null,
    items: ['5 members', '100 tasks', 'Basic charts', 'Kanban board', '100 MB storage'],
    cta:   { label: 'Start Free', to: '/admin/register', style: 'border border-slate-700 text-white hover:bg-white/5' },
  },
  {
    name:  'Pro',
    price: '₹999',
    sub:   '/month',
    color: 'border-indigo-500/80 shadow-lg shadow-indigo-500/5',
    badge: 'Most Popular',
    items: ['25 members', 'Unlimited tasks', 'Advanced analytics', 'Real-time sync', 'File uploads 5 GB', 'Priority support'],
    cta:   { label: 'Start Pro Trial', to: '/admin/register', style: 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:opacity-95' },
  },
  {
    name:  'Enterprise',
    price: '₹2,999',
    sub:   '/month',
    color: 'border-amber-500/30',
    badge: null,
    items: ['Unlimited members', 'Unlimited everything', 'Custom reports', 'Public API access', 'Audit logs', 'Dedicated support'],
    cta:   { label: 'Contact Sales', to: '/admin/register', style: 'border border-amber-500/40 text-amber-400 hover:bg-amber-500/10' },
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

  return (
    <div className="bg-slate-950 text-white min-h-screen overflow-x-hidden">

      {/* ══════════════════════ NAVBAR ══════════════════════════════════════ */}
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? 'bg-slate-950/90 backdrop-blur-xl border-b border-slate-900 shadow-xl' : ''}`}>
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-16">
          <span className="text-xl font-extrabold tracking-tight flex items-center gap-1.5">
            <span className="w-2.5 h-5 bg-gradient-to-b from-indigo-500 to-violet-600 rounded-sm inline-block"></span>
            Task<span className="text-indigo-400">Flow</span>
          </span>

          <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-400">
            {['Features', 'Pricing', 'Testimonials'].map((s) => (
              <a key={s} href={`#${s.toLowerCase()}`} className="hover:text-white transition">{s}</a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link to="/login" className="text-sm font-semibold text-slate-300 hover:text-white transition px-4 py-1.5">Login</Link>
            <Link to="/admin/register" className="text-sm font-bold bg-gradient-to-r from-indigo-600 to-violet-600 text-white px-5 py-2.5 rounded-xl hover:opacity-95 transition-all shadow-lg shadow-indigo-600/20 hover:-translate-y-0.5 active:translate-y-0">
              Get Started
            </Link>
          </div>

          <button className="md:hidden text-slate-400" onClick={() => setMenuOpen((o) => !o)}>
            {menuOpen ? <LuX className="text-xl" /> : <LuMenu className="text-xl" />}
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden bg-slate-900 border-t border-slate-800 px-6 py-4 space-y-3">
            {['features', 'pricing', 'testimonials'].map((s) => (
              <a key={s} href={`#${s}`} className="block text-sm font-medium capitalize text-slate-300 hover:text-white" onClick={() => setMenuOpen(false)}>{s}</a>
            ))}
            <div className="flex gap-3 pt-2">
              <Link to="/login"  className="flex-1 text-center text-sm border border-slate-700 text-white rounded-xl py-2.5 hover:bg-white/5 transition font-semibold">Login</Link>
              <Link to="/admin/register" className="flex-1 text-center text-sm bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl py-2.5 hover:opacity-90 transition font-bold">Sign Up</Link>
            </div>
          </div>
        )}
      </nav>

      {/* ══════════════════════ HERO ════════════════════════════════════════ */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 pt-20 overflow-hidden">
        {/* Background glows */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-cyan-500/5 rounded-full blur-3xl" />
        </div>

        {/* Badge */}
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-4 py-1.5 rounded-full mb-6 animate-fade-in">
          <LuZap className="text-yellow-400" /> Now with Supabase Realtime · Multi-tenant RLS
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold leading-tight mb-6 animate-fade-in"
          style={{ animationDelay: '0.1s' }}>
          The Task Manager<br />
          <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
            Built for Teams
          </span>
        </h1>

        <p className="text-lg text-slate-400 max-w-2xl mb-10 leading-relaxed animate-fade-in" style={{ animationDelay: '0.2s' }}>
          Enterprise-grade multi-tenant task management. Kanban boards, real-time collaboration, file uploads, audit logs, and workspace isolation — all in one beautiful app.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <Link
            to="/admin/register"
            className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold px-8 py-4 rounded-2xl text-base shadow-2xl shadow-indigo-600/20 transition-all hover:scale-105"
          >
            Start Free Today <LuArrowRight />
          </Link>
          <Link
            to="/login"
            className="flex items-center gap-2 text-sm font-semibold text-slate-300 border border-slate-800 hover:border-slate-700 px-6 py-4 rounded-2xl transition hover:bg-white/5"
          >
            Sign In to Dashboard
          </Link>
        </div>

        <p className="text-xs text-slate-600 mt-5">No credit card required · Free plan forever</p>

        {/* Mock UI preview */}
        <div className="relative mt-16 w-full max-w-5xl animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-600/20 to-violet-600/20 rounded-3xl blur-xl" />
          <div className="relative bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl p-6">
            {/* Mock Kanban */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { col: 'Pending',     color: 'from-violet-500 to-violet-700', cards: ['Design new landing page', 'Write API docs'] },
                { col: 'In Progress', color: 'from-cyan-500 to-cyan-700',     cards: ['Implement auth flow', 'Dashboard charts'] },
                { col: 'Completed',   color: 'from-lime-500 to-lime-700',     cards: ['Database migrations', 'RLS policies'] },
              ].map(({ col, color, cards }) => (
                <div key={col}>
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r ${color} mb-3 text-xs font-bold text-white`}>
                    <div className="w-2 h-2 rounded-full bg-white/60" />{col}
                  </div>
                  <div className="space-y-2">
                    {cards.map((c) => (
                      <div key={c} className="bg-slate-800 border border-slate-700 rounded-xl p-3">
                        <div className="h-2 bg-slate-600 rounded-full mb-2 w-3/4" />
                        <p className="text-[10px] text-slate-400">{c}</p>
                        <div className="flex items-center gap-1 mt-2">
                          {['bg-blue-500','bg-purple-500','bg-pink-500'].map((c2) => (
                            <div key={c2} className={`w-4 h-4 rounded-full ${c2} border-2 border-slate-800`} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════ STATS ════════════════════════════════════════ */}
      <section className="py-16 border-y border-slate-800 bg-slate-900/50">
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {STATS.map((s) => (
            <div key={s.label}>
              <p className="text-4xl font-extrabold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">{s.value}</p>
              <p className="text-sm text-slate-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════ FEATURES ════════════════════════════════════ */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-3">Everything you need</p>
            <h2 className="text-4xl font-bold text-white">Built for modern teams</h2>
            <p className="text-slate-400 mt-4 max-w-xl mx-auto">
              From real-time Kanban to enterprise security — TaskFlow has every layer covered.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 hover:-translate-y-1 transition-all duration-300 group"
              >
                <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-4 shadow-lg`}>
                  <f.icon className="text-white text-lg" />
                </div>
                <h3 className="font-bold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════ PRICING ═════════════════════════════════════ */}
      <section id="pricing" className="py-24 px-6 bg-slate-900/40">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold text-purple-400 uppercase tracking-widest mb-3">Simple pricing</p>
            <h2 className="text-4xl font-bold text-white">Start free, scale as you grow</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`relative bg-slate-900 border-2 rounded-2xl p-7 flex flex-col ${plan.color}`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-1 rounded-full">
                    {plan.badge}
                  </div>
                )}

                <div className="mb-5">
                  <h3 className="font-bold text-white text-lg">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-3xl font-extrabold text-white">{plan.price}</span>
                    <span className="text-slate-400 text-sm">{plan.sub}</span>
                  </div>
                </div>

                <ul className="space-y-2.5 flex-1 mb-7">
                  {plan.items.map((item) => (
                    <li key={item} className="flex items-center gap-2.5 text-sm text-slate-300">
                      <LuCheck className="text-lime-400 flex-shrink-0 text-sm" />
                      {item}
                    </li>
                  ))}
                </ul>

                <Link
                  to={plan.cta.to}
                  className={`block text-center font-semibold py-3 rounded-xl transition text-sm ${plan.cta.style}`}
                >
                  {plan.cta.label}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════ TESTIMONIALS ════════════════════════════════ */}
      <section id="testimonials" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold text-cyan-400 uppercase tracking-widest mb-3">Loved by teams</p>
            <h2 className="text-4xl font-bold text-white">What our users say</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition">
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.stars }).map((_, i) => (
                    <LuStar key={i} className="text-amber-400 text-sm fill-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-slate-300 leading-relaxed mb-5">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-bold">{t.avatar}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{t.name}</p>
                    <p className="text-[11px] text-slate-500">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════ CTA ══════════════════════════════════════════ */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="relative bg-gradient-to-br from-indigo-950/70 to-violet-950/70 border border-indigo-500/15 rounded-3xl p-14 shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/5 to-violet-600/5 rounded-3xl" />
            <div className="relative">
              <h2 className="text-4xl font-extrabold text-white mb-4">Ready to ship faster?</h2>
              <p className="text-slate-400 mb-8 max-w-md mx-auto leading-relaxed">
                Join teams already using TaskFlow to manage projects, ship tasks, and collaborate without chaos.
              </p>
              <Link
                to="/admin/register"
                className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold px-10 py-4 rounded-2xl text-base shadow-2xl shadow-indigo-600/20 hover:opacity-95 hover:scale-105 transition-all"
              >
                Create Free Account <LuArrowRight />
              </Link>
              <p className="text-xs text-slate-600 mt-4">No credit card · Cancel anytime</p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════ FOOTER ═══════════════════════════════════════ */}
      <footer className="border-t border-slate-900 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-sm font-bold flex items-center gap-1.5">
            <span className="w-2 h-4 bg-gradient-to-b from-indigo-500 to-violet-600 rounded-sm inline-block"></span>
            Task<span className="text-indigo-400">Flow</span>
            <span className="text-slate-600 font-normal ml-2">© {new Date().getFullYear()}</span>
          </span>
          <div className="flex items-center gap-6 text-xs text-slate-500">
            <Link to="/login"  className="hover:text-white transition">Login</Link>
            <Link to="/admin/register" className="hover:text-white transition">Sign Up</Link>
            <a href="#features" className="hover:text-white transition">Features</a>
            <a href="#pricing"  className="hover:text-white transition">Pricing</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
