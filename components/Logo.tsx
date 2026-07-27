"use client";

import { useId } from "react";

/**
 * The Momentum mark, filled with the blue→purple gradient used across the app.
 * The gradient id is generated per instance so several logos on one page can't
 * collide.
 */
export function Logo({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 -4 512 231" className={className} role="img" aria-label="Momentum">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4589ff" />
          <stop offset="0.55" stopColor="#0f62fe" />
          <stop offset="1" stopColor="#8a3ffc" />
        </linearGradient>
      </defs>
      <g fill={`url(#${id})`}>
        <path d="M0 225 L139 33 Q189 -36 237 33 L374 225 L288 225 L187 81 L85 225 Z" />
        <path d="M137 225 L200 139 L243 198 L223 225 Z" />
        <path d="M270 43 L276 33 Q326 -36 375 33 L511 225 L426 225 L326 88 L312 103 Z" />
      </g>
    </svg>
  );
}
