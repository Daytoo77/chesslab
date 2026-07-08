// Synthesized audio (WebAudio, zero assets — single-file friendly).
// Piece sounds are filtered noise bursts + a low "thump": much closer to the
// real wood-on-board sound than oscillator beeps.
let ctx = null;
let muted = false;
try { muted = localStorage.getItem('chesslab_muted') === '1'; } catch {}

function ac() {
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  if (ctx && ctx.state === 'suspended') ctx.resume();
  return ctx;
}

let noiseBuf = null;
function getNoise(a) {
  if (!noiseBuf) {
    noiseBuf = a.createBuffer(1, a.sampleRate * 0.25, a.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

// the "wood" hit: noise burst through a lowpass + a quick low thump
function thock({ cutoff = 900, dur = 0.07, gain = 0.5, thump = 110, thumpGain = 0.35, when = 0 } = {}) {
  const a = ac(); if (!a || muted) return;
  const t = a.currentTime + when;
  const src = a.createBufferSource();
  src.buffer = getNoise(a);
  const lp = a.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = cutoff; lp.Q.value = 0.8;
  const g = a.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(lp); lp.connect(g); g.connect(a.destination);
  src.start(t); src.stop(t + dur + 0.02);
  if (thump) {
    const o = a.createOscillator(), og = a.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(thump * 1.6, t);
    o.frequency.exponentialRampToValueAtTime(thump, t + 0.04);
    og.gain.setValueAtTime(thumpGain, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + dur * 1.4);
    o.connect(og); og.connect(a.destination);
    o.start(t); o.stop(t + dur * 1.4 + 0.02);
  }
}

function tone(freq, dur, type = 'sine', gain = 0.06, when = 0) {
  const a = ac(); if (!a || muted) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(gain, a.currentTime + when);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + when + dur);
  o.connect(g); g.connect(a.destination);
  o.start(a.currentTime + when); o.stop(a.currentTime + when + dur + 0.02);
}

export const sounds = {
  move: () => thock({ cutoff: 850, dur: 0.06, gain: 0.45, thump: 105 }),
  capture: () => { thock({ cutoff: 1400, dur: 0.05, gain: 0.55, thump: 90, thumpGain: 0.45 }); thock({ cutoff: 700, dur: 0.07, gain: 0.35, thump: 70, when: 0.035 }); },
  check: () => { thock({ cutoff: 2200, dur: 0.05, gain: 0.4, thump: 0 }); tone(740, 0.14, 'sine', 0.06, 0.02); },
  success: () => { tone(523, 0.12, 'sine', 0.08); tone(659, 0.12, 'sine', 0.08, 0.11); tone(784, 0.2, 'sine', 0.08, 0.22); },
  fail: () => { tone(220, 0.18, 'sawtooth', 0.045); tone(160, 0.22, 'sawtooth', 0.045, 0.12); },
  tick: () => tone(880, 0.04, 'sine', 0.05),
  gameStart: () => { thock({ cutoff: 1000, dur: 0.08, gain: 0.4, thump: 95 }); tone(523, 0.14, 'sine', 0.06, 0.08); },
  victory: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'sine', 0.08, i * 0.12)); },
  defeat: () => { [330, 262, 220, 175].forEach((f, i) => tone(f, 0.2, 'triangle', 0.06, i * 0.14)); },
  draw: () => { tone(440, 0.14, 'sine', 0.06); tone(440, 0.18, 'sine', 0.05, 0.16); },
  lowTime: () => tone(1040, 0.05, 'square', 0.04),
  // a shimmering sparkle for a brilliancy — bright bell arpeggio + a high twinkle
  brilliant: () => {
    [784, 988, 1175, 1568].forEach((f, i) => { tone(f, 0.26, 'sine', 0.07, i * 0.06); tone(f * 2, 0.18, 'sine', 0.025, i * 0.06 + 0.01); });
    tone(2350, 0.5, 'sine', 0.035, 0.26);
    tone(3136, 0.4, 'sine', 0.022, 0.34);
  },
  great: () => { tone(660, 0.12, 'sine', 0.07); tone(880, 0.16, 'sine', 0.07, 0.1); tone(1320, 0.18, 'sine', 0.04, 0.2); },
  miss: () => { tone(440, 0.16, 'triangle', 0.06); tone(330, 0.22, 'triangle', 0.06, 0.14); },
  blunder: () => { thock({ cutoff: 320, dur: 0.12, gain: 0.5, thump: 70, thumpGain: 0.5 }); tone(150, 0.3, 'sawtooth', 0.05, 0.05); },
};

// Play the move's sound (move / capture / check) plus an accent for a notable
// classification — the satisfying chess.com-style review feedback.
export function playClassified(tag, isCapture, inCheck) {
  if (inCheck) sounds.check();
  else if (isCapture) sounds.capture();
  else sounds.move();
  if (tag === 'brilliant') setTimeout(sounds.brilliant, 70);
  else if (tag === 'great') setTimeout(sounds.great, 70);
  else if (tag === 'miss') setTimeout(sounds.miss, 80);
  else if (tag === 'blunder') setTimeout(sounds.blunder, 60);
  else if (tag === 'mistake') setTimeout(sounds.miss, 80);
}
export function playForMove(m, inCheck) {
  if (inCheck) sounds.check();
  else if (m && (m.captured || (m.san && m.san.includes('x')))) sounds.capture();
  else sounds.move();
}
export function setMuted(v) { muted = v; try { localStorage.setItem('chesslab_muted', v ? '1' : '0'); } catch {} }
export function isMuted() { return muted; }
