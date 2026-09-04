import React from 'react';
import { motion } from 'framer-motion';

/**
 * VerdictMoment
 *
 * The conclusion bridge between the looping investigation scene and the
 * final ResultsView. Plays a short, deterministic sequence (~1.4s total)
 * entirely from Framer Motion timelines — no setTimeout, no real data.
 *
 * Sequence:
 *   0.00s  scene dims, scratchy lines sweep across
 *   0.10s  stamp slams in (scale 0.4 → 1.08 → 1.0, rotate -14 → -6)
 *   0.55s  red underline draws under the verdict word
 *   1.05s  stamp + scene fade / fold up together
 *   1.40s  ready for the parent to swap to ResultsView
 *
 * Props
 *   reveal   boolean  when true, the component renders its "fold away" exit
 *                    state (used by the parent to hand off cleanly).
 *   onDone   fn       called once the exit is finished.
 *   risk     string   optional real risk label so the stamp can show the
 *                    genuine word (e.g. "CAUGHT", "LOOKS OK", "UNCLEAR").
 *                    We never invent scores — only a hand-drawn label.
 */

const STAMP_WORDS = {
  HIGH: 'CAUGHT',
  MEDIUM: 'CAUGHT',
  LOW: 'CLEAR',
  UNKNOWN: 'CAUGHT',
};

const TONE = {
  HIGH: { ink: '#ff4d4d', paper: '#fdfbf7' },
  MEDIUM: { ink: '#ff4d4d', paper: '#fdfbf7' },
  LOW: { ink: '#2d5da1', paper: '#fdfbf7' },
  UNKNOWN: { ink: '#ff4d4d', paper: '#fdfbf7' },
};

const Stamp = ({ word, ink, paper, exiting }) => (
  <motion.div
    initial={{ scale: 0.4, rotate: -16, opacity: 0, y: 6 }}
    animate={
      exiting
        ? { scale: 0.85, rotate: -8, opacity: 0, y: -10 }
        : { scale: [0.4, 1.12, 1.0], rotate: [-16, -4, -6], opacity: 1, y: 0 }
    }
    transition={
      exiting
        ? { duration: 0.35, ease: [0.4, 0, 1, 1] }
        : { duration: 0.55, times: [0, 0.6, 1], ease: [0.2, 0.8, 0.2, 1] }
    }
    className="relative inline-flex items-center justify-center"
    style={{ transformOrigin: 'center' }}
  >
    {/* outer wobbly border */}
    <svg
      width="240"
      height="120"
      viewBox="0 0 240 120"
      className="absolute inset-0"
      aria-hidden="true"
    >
      <path
        d="M 14 18 C 8 38, 6 70, 16 96 C 50 112, 130 116, 200 110 C 226 106, 234 80, 230 56 C 234 30, 216 12, 188 10 C 120 4, 50 6, 22 12 C 16 14, 14 16, 14 18 Z"
        fill={paper}
        stroke={ink}
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <path
        d="M 18 24 C 14 42, 14 70, 22 92 C 60 104, 130 108, 196 102 C 218 98, 224 76, 220 56 C 222 36, 208 18, 184 18 C 120 14, 50 16, 26 22"
        fill="none"
        stroke={ink}
        strokeWidth="1.4"
        strokeLinejoin="round"
        strokeDasharray="2 3"
        opacity="0.55"
      />
    </svg>

    <div className="relative flex flex-col items-center justify-center px-8 py-5">
      <div
        className="font-marker uppercase leading-none"
        style={{
          color: ink,
          fontSize: 'clamp(34px, 5vw, 46px)',
          letterSpacing: '0.04em',
          textShadow: '1px 1px 0 rgba(45,45,45,0.15)',
        }}
      >
        {word}
      </div>
      <div className="relative mt-1.5">
        <div
          className="font-hand uppercase tracking-[0.32em] text-pencil/55"
          style={{ fontSize: '10px' }}
        >
          case sealed
        </div>
        <svg
          className="absolute left-0 -bottom-1 w-full"
          viewBox="0 0 80 6"
          fill="none"
          preserveAspectRatio="none"
          aria-hidden="true"
          style={{ overflow: 'visible' }}
        >
          <motion.path
            d="M 2 4 Q 20 1, 40 4 T 78 4"
            stroke={ink}
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: exiting ? 0 : 1 }}
            transition={{ duration: 0.5, ease: 'easeOut', delay: 0.45 }}
          />
        </svg>
      </div>
    </div>
  </motion.div>
);

const ScratchySweep = () => (
  <motion.svg
    className="absolute inset-0 w-full h-full pointer-events-none"
    viewBox="0 0 100 100"
    preserveAspectRatio="none"
    initial={{ opacity: 0 }}
    animate={{ opacity: 0.85 }}
    transition={{ duration: 0.25, ease: 'easeOut' }}
    aria-hidden="true"
  >
    {Array.from({ length: 7 }).map((_, i) => (
      <motion.path
        key={i}
        d={`M 0 ${20 + i * 12} Q 50 ${10 + i * 12}, 100 ${24 + i * 12}`}
        stroke="#2d2d2d"
        strokeWidth="0.6"
        strokeLinecap="round"
        fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut', delay: 0.05 + i * 0.04 }}
      />
    ))}
  </motion.svg>
);

const VerdictMoment = ({ onDone, risk }) => {
  const tone = TONE[risk] || TONE.UNKNOWN;
  const word = STAMP_WORDS[risk] || STAMP_WORDS.UNKNOWN;

  React.useEffect(() => {
    if (!onDone) return undefined;
    // Stamp holds ~1.05s, then hands off to the parent which will fold
    // the scene away and mount ResultsView.
    const t = setTimeout(onDone, 1050);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      className="absolute inset-0 z-20 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <motion.div
        className="absolute inset-0"
        initial={{ backgroundColor: 'rgba(253,251,247,0)' }}
        animate={{ backgroundColor: 'rgba(253,251,247,0.55)' }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      />

      <ScratchySweep />

      <div className="relative">
        <Stamp word={word} ink={tone.ink} paper={tone.paper} exiting={false} />
      </div>
    </motion.div>
  );
};

export default VerdictMoment;
