import React, { useEffect, useRef } from 'react';
import { LuCircleCheck } from 'react-icons/lu';

const AuthLayout = ({ children, title = "Sign In", subtitle = "Access your workspace dashboard", variant = "split", step = 0 }) => {
  const companyName = 'Strideo';
  const canvasRef = useRef(null);

  // Left slide info based on wizard step
  const slides = [
    {
      title: "Welcome to Strideo",
      desc: "Your Gateway to Effortless Management and High-Performance Teamwork."
    },
    {
      title: "Secure Shield Core",
      desc: "Deploying cryptographic protocols to guard your workspace credentials."
    },
    {
      title: "Digital Identity Forge",
      desc: "Configure your biometric profile metadata and employee credentials."
    },
    {
      title: "Matrix Sync Completed",
      desc: "All systems operational. Redirecting to your workspace control center."
    }
  ];

  const activeSlide = slides[step] || slides[0];

  // Neural Mesh Background Canvas Animation (only used for non-split-card variants if needed)
  useEffect(() => {
    if (!immersive && variant !== "split-card") return;
    if (variant === "split-card") return; // Use the premium static gradient background for the wizard card

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationFrameId;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    class Node {
      constructor(x, y) {
        this.x = x;
        this.y = y;
        this.baseX = x;
        this.baseY = y;
        this.vx = (Math.random() - 0.5) * 0.4;
        this.vy = (Math.random() - 0.5) * 0.4;
        this.radius = Math.random() * 2 + 1;
      }

      update(mx, my) {
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < 0 || this.x > width) this.vx *= -1;
        if (this.y < 0 || this.y > height) this.vy *= -1;

        if (mx !== undefined && my !== undefined) {
          const dx = mx - this.x;
          const dy = my - this.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 120) {
            const force = (120 - dist) / 120;
            this.x -= (dx / dist) * force * 1.5;
            this.y -= (dy / dist) * force * 1.5;
          } else {
            const dxBase = this.baseX - this.x;
            const dyBase = this.baseY - this.y;
            this.x += dxBase * 0.01;
            this.y += dyBase * 0.01;
          }
        }
      }

      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = document.documentElement.classList.contains('dark')
          ? 'rgba(99, 102, 241, 0.4)'
          : 'rgba(99, 102, 241, 0.2)';
        ctx.fill();
      }
    }

    const nodes = [];
    const nodeCount = Math.min(80, Math.floor((width * height) / 15000));
    for (let i = 0; i < nodeCount; i++) {
      nodes.push(new Node(Math.random() * width, Math.random() * height));
    }

    let mouseX, mouseY;
    const handleMouseMove = (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };
    const handleMouseLeave = () => {
      mouseX = undefined;
      mouseY = undefined;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseout', handleMouseLeave);

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      ctx.lineWidth = 0.5;
      for (let i = 0; i < nodes.length; i++) {
        nodes[i].update(mouseX, mouseY);
        nodes[i].draw();

        for (let j = i + 1; j < nodes.length; j++) {
          const dist = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
          if (dist < 150) {
            const alpha = (150 - dist) / 150 * 0.15;
            ctx.strokeStyle = document.documentElement.classList.contains('dark')
              ? `rgba(99, 102, 241, ${alpha})`
              : `rgba(99, 102, 241, ${alpha * 0.7})`;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseout', handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, [variant]);

  const immersive = variant === "split-card";

  if (variant === "split-card") {
    return (
      <div className="min-h-screen w-full flex items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_35%_50%,#1e253e_0%,#0a0b0e_100%)] transition-colors duration-300 font-sans antialiased p-4 relative">
        {/* Cohesive Floating Split Card */}
        <div className="relative z-10 w-full max-w-[850px] min-h-[560px] bg-white dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-800/80 shadow-2xl rounded-3xl overflow-hidden flex flex-col md:flex-row transition-all duration-300">
          
          {/* LEFT SIDE: Wavy Banner */}
          <div className="w-full md:w-[42%] bg-gradient-to-b from-[#2563eb] to-[#1d4ed8] p-8 flex flex-col justify-between text-white relative overflow-hidden select-none">
            {/* SVG Wavy Mesh (SimpleFlow design replica) */}
            <svg className="absolute inset-0 w-full h-full object-cover opacity-30 pointer-events-none" viewBox="0 0 400 600" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Overlay curves */}
              <path d="M-100 150 Q 100 80, 500 150 T 900 150" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" fill="none" />
              <path d="M-100 170 Q 100 100, 500 170 T 900 170" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" fill="none" />
              <path d="M-100 190 Q 100 120, 500 190 T 900 190" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" fill="none" />
              <path d="M-100 210 Q 100 140, 500 210 T 900 210" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" fill="none" />
              
              <path d="M-100 250 C 80 180, 220 320, 500 250" stroke="rgba(255,255,255,0.12)" strokeWidth="1" fill="none" />
              <path d="M-100 270 C 80 200, 220 340, 500 270" stroke="rgba(255,255,255,0.12)" strokeWidth="1" fill="none" />
              <path d="M-100 290 C 80 220, 220 360, 500 290" stroke="rgba(255,255,255,0.12)" strokeWidth="1" fill="none" />
              <path d="M-100 310 C 80 240, 220 380, 500 310" stroke="rgba(255,255,255,0.12)" strokeWidth="1" fill="none" />
              
              <path d="M-100 380 C 120 450, 280 300, 500 380" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" fill="none" />
              <path d="M-100 400 C 120 470, 280 320, 500 400" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" fill="none" />
              <path d="M-100 420 C 120 490, 280 340, 500 420" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" fill="none" />
              <path d="M-100 440 C 120 510, 280 360, 500 440" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" fill="none" />

              <path d="M-100 490 Q 150 400, 500 490 T 900 490" stroke="rgba(255,255,255,0.15)" strokeWidth="1" fill="none" />
              <path d="M-100 510 Q 150 420, 500 510 T 900 510" stroke="rgba(255,255,255,0.15)" strokeWidth="1" fill="none" />
              <path d="M-100 530 Q 150 440, 500 530 T 900 530" stroke="rgba(255,255,255,0.15)" strokeWidth="1" fill="none" />
              <path d="M-100 550 Q 150 460, 500 550 T 900 550" stroke="rgba(255,255,255,0.15)" strokeWidth="1" fill="none" />
            </svg>

            {/* Logo */}
            <div className="relative z-10 flex items-center gap-2 select-none">
              <img src="/logo.png" className="w-5 h-5 object-contain bg-white/10 rounded p-0.5" alt="Logo" />
              <span className="text-[10px] font-black tracking-widest text-white uppercase">{companyName}</span>
            </div>

            {/* Changing step message */}
            <div className="relative z-10 my-auto pt-12 md:pt-0">
              <span className="text-[9px] font-mono tracking-widest uppercase text-blue-200 block mb-2">Step 0{Math.min(step + 1, 3)} / 03</span>
              <h2 className="text-xl md:text-2xl font-black text-white leading-tight mb-3">
                {activeSlide.title}
              </h2>
              <p className="text-blue-100/90 text-xs font-semibold leading-relaxed max-w-[250px]">
                {activeSlide.desc}
              </p>
            </div>

            {/* Slide Dot Indicators */}
            <div className="relative z-10 flex items-center gap-1.5 mt-8 md:mt-0">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${i === Math.min(step, 2) ? 'w-5 bg-white' : 'w-1.5 bg-white/40'}`}
                />
              ))}
            </div>
          </div>

          {/* RIGHT SIDE: Actionable Form */}
          <div className="w-full md:w-[58%] p-8 md:p-10 flex flex-col justify-between bg-white dark:bg-zinc-900">
            <div className="w-full">
              {children}
            </div>

            {/* Footer links */}
            <div className="mt-8 pt-4 border-t border-slate-100 dark:border-zinc-800/60 text-center flex flex-col sm:flex-row items-center justify-between gap-2 text-[9px] text-slate-455 dark:text-zinc-550 font-bold uppercase tracking-wider">
              <p>© 2026 {companyName.toUpperCase()} . All rights reserved.</p>
              <p>
                Built by{' '}
                <a href="https://www.cicdtech.in/" target="_blank" rel="noopener noreferrer" className="text-indigo-650 dark:text-indigo-400 hover:underline">
                  CICD Tech
                </a>
              </p>
            </div>
          </div>

        </div>
      </div>
    );
  }

  // Standard Split Screen Layout
  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-zinc-950 font-sans antialiased transition-colors duration-300">
      <div className="hidden md:flex md:w-[40%] bg-zinc-950 dark:bg-zinc-900/40 flex-col justify-between p-12 relative overflow-hidden border-r border-slate-200/50 dark:border-zinc-800/40 select-none shrink-0">
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.015] bg-[radial-gradient(rgba(255,255,255,0.15)_1px,transparent_1px)] bg-[size:16px_16px]" />
        <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] bg-indigo-600/10 dark:bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <span className="text-xs font-black tracking-tight flex items-center gap-2.5 text-white dark:text-zinc-200">
            <img src="/logo.png" className="w-6 h-6 object-contain rounded" alt="Logo" />
            <span>{companyName}</span>
          </span>
        </div>

        <div className="relative z-10 my-auto pr-6">
          <h1 className="text-2xl font-black text-neutral-100 dark:text-zinc-150 tracking-tight leading-tight mb-6">
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
              <li key={idx} className="flex items-center gap-2.5 text-xs font-semibold text-neutral-400 dark:text-zinc-555">
                <LuCircleCheck className="text-indigo-555 dark:text-indigo-400 text-sm flex-shrink-0" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 text-[10px] text-neutral-500 dark:text-zinc-600 font-bold">
          {companyName} Enterprise · Trusted by teams worldwide.
        </div>
      </div>

      <div className="w-full md:w-[60%] flex flex-col justify-center items-center px-6 py-12 bg-slate-50 dark:bg-zinc-950 transition-colors duration-300">
        <div className="w-full max-w-[420px] bg-white dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800/80 shadow-2xl shadow-slate-100/40 dark:shadow-none rounded-3xl p-8 md:p-10 transition-all duration-300">
          <div className="md:hidden flex items-center gap-2.5 mb-6 select-none justify-center">
            <img src="/logo.png" className="w-6 h-6 object-contain rounded" alt="Logo" />
            <span className="text-xs font-black text-slate-800 dark:text-zinc-200">{companyName}</span>
          </div>

          <div className="mb-6 text-center">
            <h2 className="text-base font-black text-slate-900 dark:text-zinc-100 tracking-tight">{title}</h2>
            <p className="text-xs font-semibold text-slate-450 dark:text-zinc-400 mt-1">{subtitle}</p>
          </div>
          {children}
          
          <div className="mt-8 pt-4 border-t border-slate-100/60 dark:border-zinc-800/60 text-center flex flex-col sm:flex-row items-center justify-between gap-2 text-[9px] text-slate-400 dark:text-zinc-550 font-bold uppercase tracking-wider">
            <p>© 2026 strideo . All rights reserved.</p>
            <p>Built by <a href="https://www.cicdtech.in/" target="_blank" rel="noopener noreferrer" className="text-indigo-650 dark:text-indigo-400 hover:underline">CICD Tech</a></p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;