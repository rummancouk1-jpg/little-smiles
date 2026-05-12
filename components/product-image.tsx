"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  const imgRef = useRef<HTMLImageElement | null>(null);

  const src = normalizedSources[Math.min(index, normalizedSources.length - 1)];
  const { className, onLoad, onError, priority, ...rest } = props;

  // If the image was served from cache, `onLoad` may have fired before this
  // effect attached. Reconcile by checking the element's `complete` flag.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [src]);

  return (
    <Image
      key={src}
      ref={imgRef}
      src={src}
      alt={alt}
      priority={priority}
      {...(priority
        ? { decoding: "sync" as const }
        : { loading: "lazy" as const, decoding: "async" as const })}
      {...rest}
      className={cn(
        className,
        "transition-[opacity,filter,transform] duration-500 ease-out",
        loaded ? "opacity-100" : "opacity-0"
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
