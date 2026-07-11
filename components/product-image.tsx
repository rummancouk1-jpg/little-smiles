"use client";

import { useMemo, useState } from "react";
import Image, { type ImageProps } from "next/image";

import { cn } from "@/lib/utils";

type ProductImageProps = Omit<ImageProps, "src"> & {
  sources: string[];
};

export function ProductImage({ sources, alt, ...props }: ProductImageProps) {
  const normalizedSources = useMemo(
    () => Array.from(new Set(sources)),
    [sources]
  );
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const src = normalizedSources[Math.min(index, normalizedSources.length - 1)];
  const { className, onLoad, onError, priority, ...rest } = props;

  // LCP fix: a `priority` image is (or is near) the largest paint. It must NOT
  // be gated behind a JS `onLoad` opacity flip — that reveal can only run after
  // the bundle hydrates, which pushed LCP out to ~9s even though the bytes had
  // already arrived. Priority images render fully visible and paint on decode.
  // Non-priority (lazy, below-the-fold) images are never the LCP element, so
  // they keep the gentle load-in fade.
  const fadeIn = !priority;

  return (
    <Image
      key={src}
      src={src}
      alt={alt}
      priority={priority}
      {...(priority
        ? { decoding: "sync" as const }
        : { loading: "lazy" as const, decoding: "async" as const })}
      {...rest}
      className={cn(
        className,
        fadeIn && "transition-[opacity,filter,transform] duration-500 ease-out",
        fadeIn && !loaded && "opacity-0"
      )}
      onLoad={(event) => {
        setLoaded(true);
        onLoad?.(event);
      }}
      onError={(event) => {
        setLoaded(false);
        setIndex((current) =>
          current < normalizedSources.length - 1 ? current + 1 : current
        );
        onError?.(event);
      }}
    />
  );
}
