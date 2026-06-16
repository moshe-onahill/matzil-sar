import React from "react";

interface Props {
  /** Size of the icon square in px */
  size?: number;
  /** Show "Matzil SAR" text beside the icon */
  withText?: boolean;
  className?: string;
}

/**
 * Star of David (evenodd fill-rule gives the classic hexagonal cutout center)
 * in a red rounded square — Matzil SAR brand mark.
 */
export default function MatzilLogo({ size = 40, withText = false, className = "" }: Props) {
  const r = 10; // border-radius as fraction of size
  const rx = (r / 40) * size;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Matzil SAR"
        className="shrink-0"
      >
        <rect width="48" height="48" rx={rx} fill="#dc2626" />
        {/* Star of David — two overlapping triangles, evenodd punches the center */}
        <path
          d="M24,5 L41.32,35 L6.68,35 Z M24,43 L6.68,13 L41.32,13 Z"
          fill="white"
          fillRule="evenodd"
        />
      </svg>

      {withText && (
        <div className="leading-tight">
          <div className="text-sm font-bold tracking-tight text-zinc-50">
            Matzil SAR
          </div>
          <div className="text-[10px] font-medium uppercase tracking-widest text-zinc-500">
            Search & Rescue
          </div>
        </div>
      )}
    </div>
  );
}
