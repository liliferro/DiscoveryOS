"use client";
import { useState, type ReactNode } from "react";
import Image from "next/image";

export default function BrandLogo({
  src,
  alt,
  fallback = null,
  ...props
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
  fallback?: ReactNode;
}) {
  const [failed, setFailed] = useState<string>();
  if (failed === src) return fallback;
  return (
    <Image
      {...props}
      alt={alt}
      src={src}
      unoptimized
      onError={() => setFailed(src)}
    />
  );
}
