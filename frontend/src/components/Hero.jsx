import React from 'react';
import { motion } from 'framer-motion';

/**
 * Hand-drawn forensic composition for the hero.
 * Magnifier inspecting a browser document, with evidence marks, a sticky-note
 * question, and a few handwritten labels. Pure SVG; no external assets.
 */
const HeroIllustration = () => {
  return (
    <div className="relative w-full aspect-[5/4] max-w-[480px] mx-auto select-none">
      {/* paper underneath */}
      <div
        className="absolute inset-0 bg-white border-[2.5px] border-pencil shadow-cut wob-md rotate-[-2deg]"
        style={{ borderRadius: '22px 8px 26px 10px / 12px 24px 10px 22px' }}
      >
        <div className="absolute inset-3 border-2 border-dashed border-pencil/30 rounded" />
        {/* corner crop marks */}
        <span className="absolute -top-1 -left-1 w-3 h-3 border-l-2 border-t-2 border-pencil" />
        <span className="absolute -top-1 -right-1 w-3 h-3 border-r-2 border-t-2 border-pencil" />
        <span className="absolute -bottom-1 -left-1 w-3 h-3 border-l-2 border-b-2 border-pencil" />
        <span className="absolute -bottom-1 -right-1 w-3 h-3 border-r-2 border-b-2 border-pencil" />
      </div>

      {/* browser doc */}
      <div
        className="absolute left-[6%] top-[10%] w-[72%] bg-white border-[2.5px] border-pencil shadow-cut-sm rotate-[-3deg]"
        style={{ borderRadius: '10px 6px 12px 8px / 8px 12px 6px 10px' }}
      >
        <div className="flex items-center gap-1 px-2 py-1.5 border-b-2 border-pencil bg-marker-yellow/60">
          <span className="w-2 h-2 rounded-full bg-marker-red border border-pencil" />
          <span className="w-2 h-2 rounded-full border border-pencil" />
          <span className="w-2 h-2 rounded-full border border-pencil" />
          <div className="flex-1 mx-2 bg-white border border-pencil border-dashed px-2 py-0.5">
            <div className="font-marker text-[9px] text-pencil/70 truncate">
              https://subject-under-lens.tld
            </div>
          </div>
        </div>
        <svg viewBox="0 0 200 90" className="block w-full" aria-hidden="true">
          <g stroke="#2d2d2d" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.55">
            <path d="M 12 14 H 110" />
            <path d="M 12 26 H 170" />
            <path d="M 12 38 H 150" />
            <rect x="12" y="50" width="62" height="30" rx="2" />
            <path d="M 84 56 H 178" />
            <path d="M 84 66 H 168" />
            <path d="M 84 76 H 140" />
          </g>
          {/* password-field red underline */}
          <path d="M 14 80 q 30 -4 60 0" stroke="#ff4d4d" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        </svg>
      </div>

      {/* magnifier inspecting the doc */}
      <div className="absolute right-[4%] top-[6%] w-[42%] aspect-square">
        <svg viewBox="0 0 140 140" className="w-full h-full" aria-hidden="true">
          {/* handle */}
          <g stroke="#2d2d2d" strokeWidth="4.5" strokeLinecap="round" fill="none">
            <path d="M 96 96 L 128 128" />
          </g>
          {/* ring */}
          <circle cx="64" cy="64" r="38" fill="rgba(255,255,255,0.65)" stroke="#2d2d2d" strokeWidth="4" />
          {/* glass highlight */}
          <path d="M 44 50 q 6 -10 18 -12" stroke="#2d2d2d" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.55" />
          {/* caught dot in glass */}
          <circle cx="64" cy="64" r="4" fill="#ff4d4d" stroke="#2d2d2d" strokeWidth="1.2" />
          <circle cx="64" cy="64" r="9" fill="none" stroke="#ff4d4d" strokeWidth="1.4" strokeDasharray="2 3" opacity="0.7" />
        </svg>
      </div>

      {/* "EVIDENCE" sticker (red, rotated) */}
      <div
        className="absolute left-[2%] top-[44%] -rotate-[14deg]"
      >
        <div className="relative inline-flex items-center gap-1.5 bg-marker-red text-white border-2 border-pencil px-2.5 py-1 shadow-cut-sm wob-tag">
          <span className="w-1.5 h-1.5 rounded-full bg-white" />
          <span className="font-marker uppercase text-[10px] tracking-[0.18em]">
            evidence
          </span>
        </div>
      </div>

      {/* "?" sticky note (yellow, rotated) */}
      <div className="absolute right-[2%] bottom-[6%] rotate-[8deg]">
        <div className="relative bg-marker-yellow border-2 border-pencil px-3 py-2 shadow-cut-sm wob-tag w-[68px] text-center">
          <div className="font-marker text-[28px] leading-none text-pencil">?</div>
          <div className="font-hand text-[9px] uppercase tracking-[0.18em] text-pencil/70 mt-0.5">
            suspect
          </div>
        </div>
      </div>

      {/* arrow + "look closer" annotation */}
      <div className="absolute left-[34%] bottom-[8%] -rotate-[6deg]">
        <svg width="120" height="44" viewBox="0 0 120 44" className="overflow-visible" aria-hidden="true">
          <path
            d="M 6 32 C 30 6, 70 8, 96 22"
            stroke="#2d2d2d"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeDasharray="3 3"
            fill="none"
          />
          <path d="M 90 14 L 100 22 L 92 30" stroke="#2d2d2d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
        <div className="font-hand text-[12px] text-pencil -translate-y-1 -rotate-[2deg]">
          look closer
        </div>
      </div>

      {/* circled "subject found" scribble */}
      <div className="absolute left-[8%] bottom-[10%]">
        <div className="relative inline-flex items-center">
          <span className="font-hand text-[11px] uppercase tracking-[0.16em] text-pencil/80">
            subject found
          </span>
          <svg width="120" height="34" viewBox="0 0 120 34" className="absolute -inset-2" aria-hidden="true">
            <path
              d="M 14 22 C 6 12, 26 4, 60 8 C 100 12, 116 18, 108 26 C 96 32, 40 30, 18 28 C 8 26, 12 24, 14 22 Z"
              fill="none"
              stroke="#ff4d4d"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeDasharray="3 3"
              opacity="0.85"
            />
          </svg>
        </div>
      </div>

      {/* tape strip across the top */}
      <div
        className="absolute -top-2 left-[20%] w-24 h-5 rotate-[-6deg]"
        style={{
          background: 'rgba(45,45,45,0.18)',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.18)',
        }}
      />
    </div>
  );
};

const Hero = () => {
  return (
    <section className="w-full pt-8 pb-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center"
      >
        {/* text column */}
        <div className="lg:col-span-7 flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <span className="inline-block bg-marker-yellow border-2 border-pencil px-3 py-1 font-hand text-sm wob-tag -rotate-2 shadow-cut-sm">
              Case № 01 — the inquiry
            </span>
            <span className="hidden sm:block flex-1 border-t-2 border-dashed border-pencil/40" />
          </div>

          <h1 className="font-marker text-[52px] sm:text-[72px] lg:text-[88px] leading-[0.95] tracking-tight text-pencil">
            Is this website
            <br />
            trying to catch{' '}
            <span className="relative inline-block text-marker-red rotate-[-3deg]">
              you
              <svg
                className="absolute -bottom-3 left-0 w-full"
                viewBox="0 0 200 14"
                fill="none"
                preserveAspectRatio="none"
              >
                <path
                  d="M 4 8 Q 25 1, 50 7 T 100 7 T 150 7 T 196 7"
                  stroke="#ff4d4d"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </span>
            <span className="text-marker-red">?</span>
          </h1>

          <p className="font-hand text-xl sm:text-2xl text-pencil max-w-md leading-snug">
            Investigate a website before you trust it.
          </p>


        </div>

        {/* visual column */}
        <div className="lg:col-span-5">
          <HeroIllustration />
        </div>
      </motion.div>
    </section>
  );
};

export default Hero;
