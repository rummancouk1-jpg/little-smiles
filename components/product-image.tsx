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
