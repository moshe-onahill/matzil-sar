import React from "react";
import Image from "next/image";

interface Props {
  /** Height of the logo in px (width auto-scales) */
  size?: number;
  /** Show horizontal wordmark instead of the main emblem */
  withText?: boolean;
  className?: string;
}

export default function MatzilLogo({ size = 40, withText = false, className = "" }: Props) {
  if (withText) {
    // Wordmark: 380×87, landscape
    return (
      <Image
        src="/matzil-words.avif"
        alt="Matzil SAR"
        height={size}
        width={Math.round(size * (380 / 87))}
        className={`object-contain ${className}`}
        style={{ height: size, width: "auto" }}
        priority
      />
    );
  }

  // Main emblem: 548×667, portrait
  return (
    <Image
      src="/matzil-logo.avif"
      alt="Matzil SAR"
      height={size}
      width={Math.round(size * (548 / 667))}
      className={`object-contain ${className}`}
      style={{ height: size, width: "auto" }}
      priority
    />
  );
}
