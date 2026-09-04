import React from 'react';

/**
 * Hand-drawn CaughtIn4K surveillance mark.
 * A wobbly magnifying glass inspecting a rough reticle with a tiny "caught" dot.
 */
export default function Mark({ size = 36, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      style={{ filter: 'drop-shadow(2px 2px 0 #2d2d2d)' }}
    >
      {/* rough reticle */}
      <g stroke="#2d2d2d" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M 22 6 C 30 5.6, 38 12, 38.4 21 C 38.7 30, 31 37.6, 22 38 C 13 37.8, 5.6 30, 6 22 C 6.3 13, 14 5.8, 22 6 Z" />
        <path d="M 22 2.5 L 22 6.5" />
        <path d="M 22 37.5 L 22 41.5" />
        <path d="M 2.5 22 L 6.5 22" />
        <path d="M 37.5 22 L 41.5 22" />
      </g>
      {/* tiny caught dot in center */}
      <circle cx="22" cy="22" r="2.6" fill="#ff4d4d" stroke="#2d2d2d" strokeWidth="1.2" />
      {/* magnifying glass */}
      <g stroke="#2d2d2d" strokeWidth="2.4" strokeLinecap="round" fill="none">
        <path d="M 30 30 C 33 27, 38 28, 39 32 C 40 36, 36 40, 32 39 C 28 38, 27 33, 30 30 Z" />
        <path d="M 38.5 38.5 L 44.5 44.5" />
      </g>
      {/* glass highlight squiggle */}
      <path d="M 32 33 q 1.2 -1.5, 3 -1.6" stroke="#2d2d2d" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.6" />
    </svg>
  );
}