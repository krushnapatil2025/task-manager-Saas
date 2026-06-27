// ═══════════════════════════════════════════════════════════════════════════
// Web Audio API Sound Synthesizer (Zero External Dependencies)
// Handles browser autoplay policy: queues sounds until user has interacted.
// ═══════════════════════════════════════════════════════════════════════════

let audioCtx = null;
let isUnlocked = false;
let pendingSound = null; // last queued sound while locked

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

// Called on every user gesture to unlock AudioContext permanently
function unlockAudio() {
  if (isUnlocked) return;
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => {
        isUnlocked = true;
        // Play any sound that was requested while locked
        if (pendingSound) {
          _playSound(pendingSound);
          pendingSound = null;
        }
      }).catch(() => {});
    } else {
      isUnlocked = true;
      if (pendingSound) {
        _playSound(pendingSound);
        pendingSound = null;
      }
    }
  } catch (e) { /* ignore */ }
}

// Register persistent unlock listeners on every user interaction
if (typeof window !== 'undefined') {
  ['click', 'keydown', 'touchstart', 'mousedown', 'pointerdown'].forEach(evt => {
    window.addEventListener(evt, unlockAudio, { passive: true, capture: true });
  });
}

// ── 10 Custom Notification Chime Presets ──────────────────────────────────
export const NOTIFICATION_SOUNDS = [
  { id: 'chime',    name: 'Default Chime'      },
  { id: 'bubble',   name: 'Bubble Pop'         },
  { id: 'chirp',    name: 'Digital Alert'      },
  { id: 'arpeggio', name: 'Ascending Arpeggio' },
  { id: 'ping',     name: 'Cosmic Ping'        },
  { id: 'bell',     name: 'Classic Bell'       },
  { id: 'ding',     name: 'Double Ding'        },
  { id: 'laser',    name: 'Laser Beam'         },
  { id: 'warm',     name: 'Warm Synth'         },
  { id: 'success',  name: 'Success Chime'      },
];

// Internal: actually schedules oscillator nodes
function _playSound(soundId = 'chime') {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const tone = (freq, type, t0, dur, vol0, vol1, ramp = 'exp') => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(vol0, t0);
      if (ramp === 'exp') {
        gain.gain.exponentialRampToValueAtTime(vol1, t0 + dur);
      } else {
        gain.gain.linearRampToValueAtTime(vol1, t0 + dur);
      }
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur);
    };

    if (soundId === 'bubble') {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(1600, now + 0.12);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(now); osc.stop(now + 0.15);
    }
    else if (soundId === 'chirp') {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1500, now);
      osc.frequency.exponentialRampToValueAtTime(2200, now + 0.07);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(now); osc.stop(now + 0.07);
    }
    else if (soundId === 'arpeggio') {
      tone(523.25, 'sine', now,        0.18, 0.18, 0.001);
      tone(659.25, 'sine', now + 0.09, 0.18, 0.18, 0.001);
      tone(783.99, 'sine', now + 0.18, 0.22, 0.22, 0.001);
    }
    else if (soundId === 'ping') {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1800, now);
      gain.gain.setValueAtTime(0.20, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(now); osc.stop(now + 0.7);
    }
    else if (soundId === 'bell') {
      const g1 = ctx.createGain(); const o1 = ctx.createOscillator();
      const g2 = ctx.createGain(); const o2 = ctx.createOscillator();
      o1.type = 'sine'; o1.frequency.setValueAtTime(600, now);
      g1.gain.setValueAtTime(0.15, now);
      g1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      o1.connect(g1); g1.connect(ctx.destination);
      o2.type = 'sine'; o2.frequency.setValueAtTime(900, now);
      g2.gain.setValueAtTime(0.10, now);
      g2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      o2.connect(g2); g2.connect(ctx.destination);
      o1.start(now); o1.stop(now + 0.6);
      o2.start(now); o2.stop(now + 0.6);
    }
    else if (soundId === 'ding') {
      tone(1000, 'sine', now,        0.18, 0.18, 0.001);
      tone(1250, 'sine', now + 0.10, 0.20, 0.18, 0.001);
    }
    else if (soundId === 'laser') {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1800, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.20);
      gain.gain.setValueAtTime(0.10, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.20);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(now); osc.stop(now + 0.20);
    }
    else if (soundId === 'warm') {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(329.63, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.30);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.22, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(now); osc.stop(now + 0.45);
    }
    else if (soundId === 'success') {
      tone(523.25,  'sine', now,        0.22, 0.15, 0.001);
      tone(659.25,  'sine', now + 0.06, 0.22, 0.15, 0.001);
      tone(783.99,  'sine', now + 0.12, 0.22, 0.15, 0.001);
      tone(1046.50, 'sine', now + 0.18, 0.28, 0.18, 0.001);
    }
    else {
      // Default chime
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.15);
      gain.gain.setValueAtTime(0.20, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(now); osc.stop(now + 0.35);
    }
  } catch (err) {
    console.warn('Failed to synthesize notification sound:', err);
  }
}

// Public API: play a specific sound by id
export function playNotificationSound(soundId = 'chime') {
  if (isUnlocked) {
    _playSound(soundId);
  } else {
    // Queue it — will fire as soon as the user next interacts with the page
    pendingSound = soundId;
  }
}

// Public API: play the user's currently selected preferred sound (respects mute toggle)
export function playUserPrefSound() {
  try {
    if (typeof window === 'undefined') return;
    const soundEnabled = localStorage.getItem('sound_enabled') !== 'false';
    if (!soundEnabled) return;
    const soundId = localStorage.getItem('setting_notif_sound') || 'chime';
    playNotificationSound(soundId);
  } catch (err) {
    console.warn('Failed to play preferred notification sound:', err);
  }
}
