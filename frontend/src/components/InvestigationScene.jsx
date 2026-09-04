import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

/**
 * CaughtIn4K — Investigation Scene
 *
 * A short 5–8 second motion-graphics sequence inside a hand-drawn
 * investigation notebook. Plays while the real /api/analyze request
 * is in flight. No actual analysis happens here; all labels are
 * visual staging only.
 *
 * Story (7 beats, ~8.6s, then loops):
 *   1. URL enters
 *   2. captured
 *   3. website opened
 *   4. evidence extracted
 *   5. visual inspected
 *   6. evidence converges
 *   7. CAUGHTIN4K verdict
 *
 * Honours prefers-reduced-motion.
 */

const SCENE_W = 520;
const SCENE_H = 340;

const PALETTE = {
  pencil: '#2d2d2d',
  paper: '#fdfbf7',
  red: '#ff4d4d',
  pen: '#2d5da1',
  yellow: '#fff9c4',
  muted: '#a8a29e',
};

// Beat boundaries (ms), tuned for narrative pacing. Total ≈ 8.6s.
const BEATS = {
  enter: 1100,
  capture: 1300,
  inspect: 1200,
  extract: 1200,
  visual: 1200,
  converge: 1200,
  verdict: 1400,
};
const TOTAL =
  BEATS.enter + BEATS.capture + BEATS.inspect + BEATS.extract +
  BEATS.visual + BEATS.converge + BEATS.verdict;

const BEAT_BOUNDARIES = (() => {
  const acc = [];
  let t = 0;
  for (const ms of Object.values(BEATS)) {
    t += ms;
    acc.push(t);
  }
  return acc;
})();

const beatOf = (tMs) => {
  for (let i = 0; i < BEAT_BOUNDARIES.length; i++) {
    if (tMs < BEAT_BOUNDARIES[i]) return i;
  }
  return BEAT_BOUNDARIES.length - 1;
};

const localP = (tMs, beat) => {
  const end = BEAT_BOUNDARIES[beat];
  const start = beat === 0 ? 0 : BEAT_BOUNDARIES[beat - 1];
  return Math.max(0, Math.min(1, (tMs - start) / (end - start)));
};

/* ---------- spring easing helpers ---------- */

const spring = { type: 'spring', stiffness: 170, damping: 14, mass: 0.9 };

/* ---------- hand-drawn SVG primitives ---------- */

const Magnifier = ({ size = 72, withLens = true }) => (
  <svg width={size} height={size} viewBox="0 0 80 80" fill="none" aria-hidden="true">
    <g stroke={PALETTE.pencil} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M 30 12 C 46 11, 60 24, 60 40 C 60 56, 46 68, 30 68 C 14 67, 2 55, 2 40 C 2 25, 14 13, 30 12 Z" />
      <path d="M 52 52 L 72 72" />
    </g>
    <path
      d="M 12 30 q 4 -10, 16 -12"
      stroke={PALETTE.pencil}
      strokeWidth="2"
      strokeLinecap="round"
      fill="none"
      opacity="0.5"
    />
    {withLens && (
      <circle cx="30" cy="40" r="3.6" fill={PALETTE.red}>
        <animate
          attributeName="r"
          values="3.4;4.4;3.4"
          dur="1.6s"
          repeatCount="indefinite"
        />
      </circle>
    )}
  </svg>
);

const ArcArrow = ({ d = 'M 4 8 Q 22 -2, 40 8', size = 44 }) => (
  <svg width={size} height={(size * 3) / 5} viewBox="0 0 44 22" fill="none" aria-hidden="true">
    <path
      d={d}
      stroke={PALETTE.pencil}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeDasharray="3 3"
      fill="none"
    />
    <path d="M 36 4 L 42 8 L 36 12" stroke={PALETTE.pencil} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

const ScribbleCircle = ({ size = 64, color = PALETTE.red }) => (
  <svg width={size} height={size} viewBox="0 0 80 80" fill="none" aria-hidden="true">
    <path
      d="M 40 6 C 56 8, 72 22, 70 38 C 68 54, 58 70, 42 72 C 26 74, 10 60, 8 44 C 6 28, 22 6, 40 6 Z"
      stroke={color}
      strokeWidth="2.4"
      strokeLinecap="round"
      fill="none"
      style={{ pathLength: 1 }}
    />
  </svg>
);

const TickMark = ({ size = 18, color = PALETTE.pencil }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <path
      d="M 3 9 L 7 13 L 15 4"
      stroke={color}
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

const PaperScrap = ({ children, rotate = -8, className = '' }) => (
  <span
    className={`inline-flex items-center gap-1 bg-paper-warm border-2 border-pencil px-1.5 py-0.5 wob-tag font-marker text-[10px] uppercase tracking-wider shadow-cut-sm ${className}`}
    style={{ rotate }}
  >
    {children}
  </span>
);

/* ---------- evidence shards (props drive position) ---------- */

const UrlPaper = ({ url, className = '' }) => (
  <div className={`absolute bg-white border-[2.5px] border-pencil shadow-cut wob-sm px-3 py-2 ${className}`}>
    <div className="font-marker text-[10px] uppercase tracking-wider text-pencil/55">URL</div>
    <div className="font-marker text-sm text-pencil max-w-[200px] truncate">{url}</div>
  </div>
);

const BrowserWindow = ({ url, className = '', open = 1 }) => (
  <div className={`absolute bg-white border-[2.5px] border-pencil shadow-cut wob-md overflow-hidden ${className}`}>
    <div className="flex items-center gap-1.5 px-2 py-1.5 border-b-2 border-pencil bg-marker-yellow/70">
      <span className="w-2 h-2 rounded-full bg-marker-red border border-pencil" />
      <span className="w-2 h-2 rounded-full border border-pencil" />
      <span className="w-2 h-2 rounded-full border border-pencil" />
      <div className="flex-1 mx-2 bg-white border border-pencil border-dashed wob-sm px-2 py-0.5">
        <div className="font-marker text-[10px] text-pencil truncate">{url}</div>
      </div>
    </div>
    <motion.div
      animate={{ scaleY: open }}
      style={{ transformOrigin: 'top' }}
      transition={{ duration: 0.55, ease: [0.2, 0.7, 0.2, 1] }}
      className="h-[200px] relative bg-paper-warm"
    >
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 260 200" preserveAspectRatio="none" aria-hidden="true">
        <g stroke={PALETTE.pencil} strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.45">
          <path d="M 20 30 H 160" />
          <path d="M 20 46 H 220" />
          <path d="M 20 62 H 200" />
          <rect x="20" y="82" width="100" height="60" rx="2" />
          <path d="M 140 92 H 230" />
          <path d="M 140 110 H 220" />
          <path d="M 140 128 H 200" />
          <path d="M 20 156 H 180" />
          <path d="M 20 174 H 220" />
        </g>
      </svg>
    </motion.div>
  </div>
);

const PaperSheet = ({ lines = 6, circledIndex = 2, className = '' }) => (
  <div className={`absolute bg-white border-[2.5px] border-pencil shadow-cut wob-md p-4 ${className}`}>
    <div className="font-marker text-[10px] uppercase tracking-wider text-pencil/50 mb-2">text excerpt</div>
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="relative">
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.05 * i, duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}
            style={{ transformOrigin: 'left' }}
            className={`h-2 wob-sm ${i % 2 === 0 ? 'bg-pencil/85' : 'bg-pencil/55'} ${i === lines - 1 ? 'w-2/3' : 'w-full'}`}
          />
          {i === circledIndex && (
            <motion.svg
              initial={{ opacity: 0, scale: 0.4, rotate: -10 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ delay: 0.05 * i + 0.4, type: 'spring', stiffness: 200, damping: 14 }}
              className="absolute -inset-3 w-[calc(100%+24px)] h-[calc(100%+12px)] pointer-events-none"
              viewBox="0 0 200 20"
              fill="none"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                d="M 6 12 C 30 2, 60 18, 90 8 C 120 -2, 160 14, 194 6"
                stroke={PALETTE.red}
                strokeWidth="2.4"
                strokeLinecap="round"
                fill="none"
                style={{ pathLength: 1 }}
              />
            </motion.svg>
          )}
        </div>
      ))}
    </div>
  </div>
);

const VisualSilhouette = ({ url, screenshotB64, screenshotMime, unavailable = false, className = '' }) => {
  const hasShot = !!screenshotB64;
  const src = hasShot ? `data:${screenshotMime || 'image/png'};base64,${screenshotB64}` : null;
  return (
    <div className={`absolute bg-white border-[2.5px] border-pencil shadow-cut wob-md overflow-hidden ${className}`}>
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b-2 border-pencil bg-marker-yellow/70">
        <span className="w-2 h-2 rounded-full bg-marker-red border border-pencil" />
        <span className="w-2 h-2 rounded-full border border-pencil" />
        <span className="w-2 h-2 rounded-full border border-pencil" />
        <div className="flex-1 mx-2 bg-white border border-pencil border-dashed wob-sm px-2 py-0.5">
          <div className="font-marker text-[10px] text-pencil/60 truncate">
            {hasShot ? url : 'rendering…'}
          </div>
        </div>
      </div>
      <div className="relative h-[200px] bg-paper-warm overflow-hidden">
        {src ? (
          <img
            src={src}
            alt="rendered preview"
            className="block w-full h-full object-cover"
          />
        ) : (
          <>
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 260 200" preserveAspectRatio="none" aria-hidden="true">
              <g stroke={PALETTE.pencil} strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.35">
                <rect x="16" y="14" width="100" height="14" rx="2" />
                <rect x="16" y="40" width="228" height="6" rx="1" />
                <rect x="16" y="52" width="200" height="6" rx="1" />
                <rect x="16" y="68" width="108" height="40" rx="2" />
                <rect x="16" y="116" width="60" height="14" rx="2" />
                <rect x="80" y="116" width="60" height="14" rx="2" />
                <rect x="16" y="138" width="228" height="6" rx="1" />
                <rect x="16" y="150" width="160" height="6" rx="1" />
                <rect x="16" y="164" width="120" height="14" rx="2" />
              </g>
            </svg>
            {unavailable && (
              <div
                data-testid="visual-unavailable-scene"
                className="absolute inset-0 flex flex-col items-center justify-center text-center px-4"
              >
                <div className="inline-flex items-center gap-1.5 bg-marker-yellow border-2 border-pencil px-2.5 py-1 wob-tag font-hand text-[11px] text-pencil shadow-cut-sm -rotate-2">
                  <span className="w-1.5 h-1.5 wob-circle bg-marker-red" />
                  live visual capture unavailable
                </div>
                <div className="mt-2 font-hand text-[10px] text-pencil/65 italic max-w-[200px]">
                  this deployment cannot render the page — the rest of the
                  investigation still ran.
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const LensCard = ({ className = '' }) => (
  <div className={`relative bg-paper-warm border-[3px] border-pencil shadow-cut wob-lg overflow-hidden ${className}`}>
    <span className="tape" />
    <div className="flex flex-col items-center justify-center px-7 py-6">
      <svg width="64" height="64" viewBox="0 0 80 80" fill="none" aria-hidden="true">
        <g stroke={PALETTE.pencil} strokeWidth="3" strokeLinecap="round" fill="none">
          <path d="M 30 12 C 46 11, 60 24, 60 40 C 60 56, 46 68, 30 68 C 14 67, 2 55, 2 40 C 2 25, 14 13, 30 12 Z" />
          <path d="M 52 52 L 72 72" />
        </g>
        <circle cx="30" cy="40" r="4" fill={PALETTE.red}>
          <animate attributeName="r" values="3.6;4.6;3.6" dur="1.4s" repeatCount="indefinite" />
        </circle>
      </svg>
      <div className="font-marker text-[26px] text-pencil mt-2 tracking-tight leading-none">
        CAUGHTIN4K
      </div>
      <div className="relative mt-1.5">
        <div className="font-marker text-[11px] uppercase tracking-[0.22em] text-pencil/65">
          verdict
        </div>
        <svg
          className="absolute left-0 -bottom-1 w-full"
          viewBox="0 0 60 6"
          fill="none"
          preserveAspectRatio="none"
          aria-hidden="true"
          style={{ overflow: 'visible' }}
        >
          <motion.path
            d="M 2 4 Q 15 1, 30 4 T 58 4"
            stroke={PALETTE.red}
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.35, duration: 0.55, ease: 'easeOut' }}
          />
        </svg>
      </div>
    </div>
  </div>
);

/* ---------- annotation (small sticky note) ---------- */

const Annotation = ({ x, y, rotate = 0, children, color = PALETTE.pencil }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.5, x: x - 6, y: y + 8 }}
    animate={{ opacity: 1, scale: 1, x, y }}
    exit={{ opacity: 0, scale: 0.85 }}
    transition={spring}
    style={{ rotate }}
    className="absolute pointer-events-none"
  >
    <div
      className="inline-flex items-center gap-1.5 bg-paper-warm border-2 px-2 py-0.5 wob-tag font-hand text-[11px] shadow-cut-sm"
      style={{ borderColor: color, color }}
    >
      <span className="w-1.5 h-1.5 wob-circle" style={{ background: color }} />
      {children}
    </div>
  </motion.div>
);

/* ---------- main scene ---------- */

const InvestigationScene = forwardRef(function InvestigationScene(
  { url, screenshotB64, screenshotMime, visualUnavailable = false },
  ref
) {
  const reduceMotion = useReducedMotion();
  const [loopCount, setLoopCount] = useState(0);
  const stageRef = React.useRef(null);

  useImperativeHandle(ref, () => ({
    scrollIntoView: (opts) => {
      const el = stageRef.current;
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center', ...opts });
    },
    getStageNode: () => stageRef.current,
    snapToVerdict: () => {
      // Jump the loop directly to the final beat so the lens stamp moment
      // aligns with the backend finishing. We shift the rAF start ref so the
      // next tick already lands on the verdict beat, and we bump loopCount
      // so any key-driven children remount for the new beat context.
      const target = BEAT_BOUNDARIES[BEAT_BOUNDARIES.length - 1] - 50;
      tStartRef.current = performance.now() - target;
      setTMs(target);
      setLoopCount((n) => n + 1);
    },
  }), []);

  // Loop counter for key-driven re-mounts of beat-keyed elements
  useEffect(() => {
    if (reduceMotion) return;
    const t = setInterval(() => setLoopCount((n) => n + 1), TOTAL);
    return () => clearInterval(t);
  }, [reduceMotion]);

  // Continuous progress 0..TOTAL (rAF). Uses a start-time ref so
  // snapToVerdict() can offset the timeline without resetting state.
  const tStartRef = React.useRef(performance.now());
  const [tMs, setTMs] = useState(0);
  useEffect(() => {
    if (reduceMotion) return;
    let raf;
    const tick = (now) => {
      setTMs((now - tStartRef.current + TOTAL) % TOTAL);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduceMotion]);

  const beat = beatOf(tMs);
  const p = localP(tMs, beat);

  /* ---------- magnifier movement (choreographed, not linear) ---------- */
  // Each phase is a curve of keyframes; we step through with cubic-ease between points.
  const MAG_POSES = {
    // 1 — URL enters (hover to centre)
    0: [{ x: -120, y: SCENE_H + 60, rot: -30 }, { x: SCENE_W / 2 - 130, y: SCENE_H - 130, rot: -10 }, { x: SCENE_W / 2 - 100, y: SCENE_H - 150, rot: -4 }],
    // 2 — captured (settle, slight pulse)
    1: [{ x: SCENE_W / 2 - 100, y: SCENE_H - 150, rot: -4 }, { x: SCENE_W / 2 - 100, y: SCENE_H - 150, rot: -2 }, { x: SCENE_W / 2 - 110, y: SCENE_H - 140, rot: -2 }],
    // 3 — inspect (tour the browser: address → left → right → centre)
    2: [{ x: SCENE_W / 2 - 100, y: SCENE_H - 140, rot: -2 }, { x: 110, y: 60, rot: -10 }, { x: 30, y: 160, rot: -6 }, { x: SCENE_W - 100, y: 180, rot: 8 }, { x: SCENE_W / 2 - 50, y: 110, rot: 4 }],
    // 4 — extract text (off-stage, paper takes over)
    3: [{ x: -120, y: -100, rot: -25 }],
    // 5 — visual inspect (sweep top → bottom)
    4: [{ x: 80, y: 70, rot: -8 }, { x: SCENE_W - 110, y: 90, rot: 6 }, { x: SCENE_W - 100, y: SCENE_H - 100, rot: 10 }, { x: 80, y: SCENE_H - 100, rot: -8 }, { x: -120, y: 60, rot: -20 }],
    // 6 — converge (retreats up-right, yields the stage to the lens)
    5: [{ x: SCENE_W - 80, y: 60, rot: 18 }, { x: SCENE_W + 80, y: -40, rot: 30 }],
    // 7 — verdict (off-stage)
    6: [{ x: -160, y: -120, rot: -30 }],
  };

  const easedMove = (poses, prog) => {
    if (!poses || poses.length === 0) {
      return { x: 0, y: 0, rot: 0 };
    }
    if (poses.length === 1) {
      const only = poses[0];
      return { x: only.x, y: only.y, rot: only.rot };
    }
    const segs = poses.length - 1;
    const local = Math.max(0, Math.min(segs, prog * segs));
    const i = Math.min(segs - 1, Math.floor(local));
    const t = local - i;
    // ease in-out
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const a = poses[i];
    const b = poses[i + 1];
    return {
      x: a.x + (b.x - a.x) * e,
      y: a.y + (b.y - a.y) * e,
      rot: a.rot + (b.rot - a.rot) * e,
    };
  };

  const magPos = reduceMotion
    ? { x: SCENE_W / 2 - 100, y: SCENE_H / 2 - 100, rot: -4 }
    : easedMove(MAG_POSES[beat] || [{ x: -160, y: -120, rot: -30 }], p);

  /* ---------- shard resting positions & convergence trajectories ---------- */
  // Resting positions per beat (when shard is "on stage"):
  //  URL:   centred slightly up-left during beats 0-1, then folds into lens
  //  Browser: centred during beat 2, then folds
  //  Paper: centred during beat 3, then folds
  //  Visual: centred during beat 4, then folds
  const REST = {
    0: { url: [SCENE_W / 2 - 100, SCENE_H - 150, -3], browser: null, paper: null, visual: null },
    1: { url: [SCENE_W / 2 - 100, SCENE_H - 150, -1], browser: null, paper: null, visual: null },
    2: { url: null, browser: [SCENE_W / 2 - 130, 30, -2], paper: null, visual: null },
    3: { url: null, browser: null, paper: [SCENE_W / 2 - 130, 25, -1], visual: null },
    4: { url: null, browser: null, paper: null, visual: [SCENE_W / 2 - 130, 25, 1] },
    5: { url: [SCENE_W / 2 - 100, SCENE_H - 150, -1], browser: [SCENE_W / 2 - 130, 30, -2], paper: [SCENE_W / 2 - 130, 25, -1], visual: [SCENE_W / 2 - 130, 25, 1] },
    6: { url: null, browser: null, paper: null, visual: null },
  };
  // During beat 5 (converge) the four shards spiral toward the lens centre with stagger.
  const shardAnimProps = (kind, beatI, pLocal) => {
    const rest = REST[beatI]?.[kind];
    if (!rest) return { x: -9999, y: -9999, scale: 0, opacity: 0, rotate: 0 };

    if (beatI === 5) {
      // Each shard eases toward (cx, cy) with its own stagger
      const stagger = kind === 'url' ? 0.0 : kind === 'browser' ? 0.08 : kind === 'paper' ? 0.16 : 0.24;
      const local = Math.max(0, Math.min(1, (pLocal - stagger) / (1 - stagger)));
      const e = 1 - Math.pow(1 - local, 2.6);
      const cx = SCENE_W / 2 - 100;
      const cy = SCENE_H / 2 - 70;
      const [rx, ry, rrot] = rest;
      return {
        x: rx + (cx - rx) * e,
        y: ry + (cy - ry) * e,
        scale: 1 - 0.55 * e,
        opacity: Math.max(0, 1 - e * 1.1),
        rotate: rrot * (1 - e),
      };
    }

    // Mount-in transition for each shard's "first appearance" beat
    const entering =
      (kind === 'url' && beatI === 0) ||
      (kind === 'browser' && beatI === 2) ||
      (kind === 'paper' && beatI === 3) ||
      (kind === 'visual' && beatI === 4);

    if (entering) {
      const [rx, ry, rrot] = rest;
      const e = pLocal < 0.7 ? pLocal / 0.7 : 1; // ease-in
      const te = 1 - Math.pow(1 - e, 3);
      // start positions per shard
      const starts = {
        url: [SCENE_W * 0.05, SCENE_H + 30, -16],
        browser: [SCENE_W * 0.5 - 130, SCENE_H * 0.5 - 100, -10],
        paper: [SCENE_W * 0.5 - 130, SCENE_H * 0.5 - 100, 8],
        visual: [SCENE_W * 0.95 - 260, SCENE_H * 0.5 - 100, 12],
      };
      const [sx, sy, srot] = starts[kind];
      return {
        x: sx + (rx - sx) * te,
        y: sy + (ry - sy) * te,
        scale: 0.85 + 0.15 * te,
        opacity: te,
        rotate: srot + (rrot - srot) * te,
      };
    }

    // Holding steady
    const [rx, ry, rrot] = rest;
    return { x: rx, y: ry, scale: 1, opacity: 1, rotate: rrot };
  };

  const urlProps = shardAnimProps('url', beat, p);
  const browserProps = shardAnimProps('browser', beat, p);
  const paperProps = shardAnimProps('paper', beat, p);
  const visualProps = shardAnimProps('visual', beat, p);

  /* ---------- magnifier visibility ---------- */
  const magVisible = reduceMotion ? true : !(beat === 6 || (beat === 5 && p > 0.85));

  /* ---------- annotation slots ---------- */
  // Choose annotations per beat (hand-tuned)
  const annotations = (() => {
    if (reduceMotion) return [];
    if (beat === 0) return [
      { x: SCENE_W / 2 - 50, y: 50, rotate: -4, color: PALETTE.pen, key: `a0a-${loopCount}`, label: 'caught it' },
    ];
    if (beat === 1) return [
      { x: SCENE_W / 2 + 40, y: SCENE_H / 2 + 60, rotate: 3, color: PALETTE.red, key: `a1-${loopCount}`, label: 'noted.' },
    ];
    if (beat === 2 && p < 0.5) return [
      { x: SCENE_W - 140, y: 45, rotate: 2, color: PALETTE.pen, key: `a2a-${loopCount}`, label: 'domain' },
    ];
    if (beat === 2 && p >= 0.5) return [
      { x: 24, y: SCENE_H - 70, rotate: -3, color: PALETTE.pen, key: `a2b-${loopCount}`, label: 'forms?' },
    ];
    if (beat === 3) return [
      { x: SCENE_W - 110, y: 50, rotate: 4, color: PALETTE.pen, key: `a3-${loopCount}`, label: 'reading…' },
    ];
    if (beat === 4) return [
      { x: 24, y: 40, rotate: -3, color: PALETTE.pen, key: `a4-${loopCount}`, label: 'layout' },
    ];
    if (beat === 5) return [
      { x: SCENE_W / 2 + 30, y: 50, rotate: 2, color: PALETTE.red, key: `a5-${loopCount}`, label: 'converging…' },
    ];
    if (beat === 6 && p < 0.55) return [
      { x: 30, y: SCENE_H - 80, rotate: -3, color: PALETTE.pencil, key: `a6-${loopCount}`, label: 'seen it all.' },
    ];
    return [];
  })();

  /* ---------- scribble accents per beat ---------- */
  const accents = (() => {
    if (reduceMotion) return [];
    if (beat === 0) return []; // arc-arrow drawn separately
    if (beat === 1) return [
      // small tick next to URL paper
      { kind: 'tick', x: SCENE_W / 2 + 60, y: SCENE_H - 130, size: 22, color: PALETTE.red, key: `t1-${loopCount}` },
    ];
    if (beat === 2) return [
      // circle around the address bar
      { kind: 'circle', x: SCENE_W / 2 - 150, y: 14, size: 280, color: PALETTE.red, key: `c2-${loopCount}` },
    ];
    if (beat === 4) return [
      // circle around the visual region
      { kind: 'circle', x: SCENE_W / 2 - 150, y: 14, size: 280, color: PALETTE.red, key: `c4-${loopCount}` },
      // tiny ticks at corners
      { kind: 'tick', x: SCENE_W / 2 + 130, y: 24, size: 18, color: PALETTE.pencil, key: `t4a-${loopCount}` },
      { kind: 'tick', x: SCENE_W / 2 - 150, y: 24, size: 18, color: PALETTE.pencil, key: `t4b-${loopCount}` },
    ];
    return [];
  })();

  /* ---------- lens signature moment ---------- */
  const lensAppear = beat === 6;
  const lensScale = lensAppear
    ? p < 0.18
      ? 0.4 + (p / 0.18) * 0.7   // stamp in
      : 1.0
    : 0;
  const lensOpacity = lensAppear ? Math.min(1, p / 0.18) : 0;

  /* ---------- arc-arrow that draws at the very start ---------- */
  const drawEnterArrow = beat === 0 && p < 0.7;

  /* ---------- reduced motion: static summary card ---------- */
  if (reduceMotion) {
    return (
      <div
        ref={stageRef}
        data-investigation-scene
        className="relative w-full max-w-3xl mx-auto mt-12"
      >
        <div className="relative bg-white border-[3px] border-pencil shadow-cut wob-md p-6 text-center">
          <span className="tape" />
          <div className="font-marker text-xl text-pencil">Investigating…</div>
          <div className="font-hand text-sm text-pencil/70 mt-1 italic">
            the field notebook is being filled in
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={stageRef}
      data-investigation-scene
      className="relative w-full max-w-3xl mx-auto mt-12"
    >
      {/* Section heading */}
      <div className="flex items-center gap-3 mb-5">
        <span className="inline-block bg-marker-yellow border-2 border-pencil px-3 py-1 font-hand text-sm wob-tag -rotate-1 shadow-cut-sm">
          Case № 02 — under investigation
        </span>
        <span className="hidden sm:block flex-1 border-t-2 border-dashed border-pencil/40" />
        <span className="font-hand text-sm text-pencil/70">
          {BEAT_LABELS[beat]}
        </span>
      </div>

      {/* Stage */}
      <div
        className="relative bg-white border-[3px] border-pencil shadow-cut wob-md overflow-hidden mx-auto"
        style={{ width: '100%', maxWidth: SCENE_W, height: SCENE_H }}
      >
        {/* paper grain */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(rgba(45,45,45,0.06) 1px, transparent 1px)',
            backgroundSize: '18px 18px',
          }}
        />

        {/* entering arc-arrow */}
        <AnimatePresence>
          {drawEnterArrow && (
            <motion.div
              key={`arrow-${loopCount}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute"
              style={{ left: SCENE_W * 0.08, top: SCENE_H * 0.55, rotate: -10 }}
            >
              <svg width="120" height="60" viewBox="0 0 120 60" fill="none" aria-hidden="true">
                <motion.path
                  d="M 6 48 Q 50 6, 100 30"
                  stroke={PALETTE.pencil}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeDasharray="4 4"
                  fill="none"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                />
                <motion.path
                  d="M 92 22 L 102 30 L 94 38"
                  stroke={PALETTE.pencil}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.55, duration: 0.15 }}
                />
              </svg>
            </motion.div>
          )}
        </AnimatePresence>

        {/* === Evidence shards === */}

        {/* URL paper */}
        {(beat === 0 || beat === 1 || beat === 5) ? (
          <motion.div
            key={`url-${loopCount}`}
            style={{ left: 0, top: 0 }}
            animate={{
              x: urlProps.x,
              y: urlProps.y,
              scale: urlProps.scale,
              opacity: urlProps.opacity,
              rotate: urlProps.rotate,
            }}
            transition={{ type: 'spring', stiffness: 140, damping: 16, mass: 1 }}
            className="absolute"
          >
            <UrlPaper url={url} />
          </motion.div>
        ) : null}

        {/* Browser */}
        {beat === 2 || beat === 5 ? (
          <motion.div
            key={`browser-${loopCount}`}
            style={{ left: 0, top: 0 }}
            animate={{
              x: browserProps.x,
              y: browserProps.y,
              scale: browserProps.scale,
              opacity: browserProps.opacity,
              rotate: browserProps.rotate,
            }}
            transition={{ type: 'spring', stiffness: 140, damping: 16, mass: 1 }}
            className="absolute"
          >
            <BrowserWindow url={url} open={beat === 2 ? Math.min(1, p * 1.6) : 1} />
          </motion.div>
        ) : null}

        {/* Paper */}
        {beat === 3 || beat === 5 ? (
          <motion.div
            key={`paper-${loopCount}`}
            style={{ left: 0, top: 0 }}
            animate={{
              x: paperProps.x,
              y: paperProps.y,
              scale: paperProps.scale,
              opacity: paperProps.opacity,
              rotate: paperProps.rotate,
            }}
            transition={{ type: 'spring', stiffness: 140, damping: 16, mass: 1 }}
            className="absolute"
          >
            <PaperSheet lines={6} circledIndex={2} />
          </motion.div>
        ) : null}

        {/* Visual */}
        {beat === 4 || beat === 5 ? (
          <motion.div
            key={`visual-${loopCount}`}
            style={{ left: 0, top: 0 }}
            animate={{
              x: visualProps.x,
              y: visualProps.y,
              scale: visualProps.scale,
              opacity: visualProps.opacity,
              rotate: visualProps.rotate,
            }}
            transition={{ type: 'spring', stiffness: 140, damping: 16, mass: 1 }}
            className="absolute"
          >
            <VisualSilhouette url={url} screenshotB64={screenshotB64} screenshotMime={screenshotMime} unavailable={visualUnavailable} />
          </motion.div>
        ) : null}

        {/* === Accents (ticks, circles) === */}
        <AnimatePresence>
          {accents.map((a) => (
            <motion.div
              key={a.key}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={spring}
              className="absolute pointer-events-none"
              style={{ left: a.x, top: a.y, transform: 'translate(-50%, -50%)' }}
            >
              {a.kind === 'circle' ? <ScribbleCircle size={a.size} color={a.color} /> : null}
              {a.kind === 'tick' ? <TickMark size={a.size} color={a.color} /> : null}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* === Annotations === */}
        <AnimatePresence>
          {annotations.map((a) => (
            <Annotation key={a.key} x={a.x} y={a.y} rotate={a.rotate} color={a.color}>
              {a.label}
            </Annotation>
          ))}
        </AnimatePresence>

        {/* === Magnifier (protagonist) === */}
        <AnimatePresence>
          {magVisible && (
            <motion.div
              key={`mag-${loopCount}-${beat}`}
              initial={false}
              animate={{
                x: magPos.x,
                y: magPos.y,
                rotate: magPos.rot,
                scale: beat === 6 ? 0 : 1,
                opacity: beat === 6 ? 0 : 1,
              }}
              transition={
                beat === 0 || beat === 3 || beat === 5
                  ? spring
                  : { duration: 0.85, ease: [0.25, 0.7, 0.25, 1] }
              }
              className="absolute pointer-events-none"
              style={{ left: 0, top: 0, filter: 'drop-shadow(2px 2px 0 #2d2d2d)' }}
            >
              <Magnifier size={72} withLens={beat !== 6} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* === Lens signature moment === */}
        <AnimatePresence>
          {lensAppear && (
            <motion.div
              key={`lens-${loopCount}`}
              initial={false}
              animate={{ scale: lensScale, opacity: lensOpacity }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={spring}
              className="absolute"
              style={{ left: SCENE_W / 2 - 110, top: SCENE_H / 2 - 70 }}
            >
              <LensCard />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Beat indicator dots */}
        <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
          {BEAT_LABELS.map((_, i) => (
            <span
              key={i}
              className={`w-1.5 h-1.5 wob-circle transition-all ${i === beat ? 'bg-marker-red' : 'bg-pencil/25'
                }`}
            />
          ))}
        </div>
      </div>


    </div>
  );
});

const BEAT_LABELS = [
  'URL entered…',
  'captured.',
  'opening the page…',
  'reading the text…',
  'scanning the layout…',
  'converging evidence…',
  'caught.',
];

export default InvestigationScene;