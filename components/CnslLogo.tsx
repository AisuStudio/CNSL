// CNSL logo (vector monogram). Square; colour follows the accent token.
export default function CnslLogo({ size = 34 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 41.34 41.34"
      role="img"
      aria-label="CNSL"
      style={{ display: "block", flexShrink: 0 }}
    >
      <g fill="var(--color-accent)">
        <polygon points="0 0 0 19.08 19.08 19.08 19.08 12.72 6.36 12.72 6.36 6.36 19.08 6.36 19.08 0 0 0" />
        <polygon points="22.26 0 22.26 19.08 28.62 19.08 28.62 6.36 34.98 6.36 34.98 19.08 41.34 19.08 41.34 0 22.26 0" />
        <polygon points="6.36 22.26 6.36 34.98 0 34.98 0 41.34 12.72 41.34 12.72 28.62 19.08 28.62 19.08 22.26 6.36 22.26" />
        <polygon points="28.62 34.98 28.62 22.26 22.26 22.26 22.26 41.34 41.34 41.34 41.34 34.98 28.62 34.98" />
      </g>
    </svg>
  );
}
