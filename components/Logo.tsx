export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 -4 512 231"
      className={className}
      role="img"
      aria-label="Momentum"
      fill="currentColor"
    >
      <path d="M0 225 L139 33 Q189 -36 237 33 L374 225 L288 225 L187 81 L85 225 Z" />
      <path d="M137 225 L200 139 L243 198 L223 225 Z" />
      <path d="M270 43 L276 33 Q326 -36 375 33 L511 225 L426 225 L326 88 L312 103 Z" />
    </svg>
  );
}
