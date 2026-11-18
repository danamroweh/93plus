"use client";

import { useState } from "react";
import { preload } from "react-dom";
import type { ProductImage } from "@/lib/commerce/types";
import { cn } from "@/lib/utils";

/**
 * One of our own photos, as a plain <img> with a srcset: the 432 / 648 /
 * 864 px copies `npm run shots` writes, so a phone downloads the size its
 * slot needs instead of the full 864 every time. next/image can't do that
 * for `unoptimized` files, and sending them through its optimiser made every
 * first view wait on a server re-encode. Shopify's CDN images still go
 * through next/image (see ProductPhoto).
 *
 * The blur placeholder is the same SVG trick next/image uses, so the frame
 * looks exactly as it did while the photo arrives.
 */
export function LocalPhoto({
  image,
  alt,
  sizes,
  preload: preloadIt,
  fetchPriority,
  draggable,
  className,
  "data-image": dataImage,
}: {
  image: ProductImage;
  alt: string;
  sizes?: string;
  /** Hero frames: fetched first, and announced in <head> before the body parses. */
  preload?: boolean;
  fetchPriority?: "high" | "low" | "auto";
  draggable?: React.ImgHTMLAttributes<HTMLImageElement>["draggable"];
  className?: string;
  "data-image"?: string;
}) {
  const [loaded, setLoaded] = useState(false);

  if (preloadIt)
    preload(image.url, {
      as: "image",
      imageSrcSet: image.srcSet,
      imageSizes: sizes,
      fetchPriority: fetchPriority ?? "high",
    });

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image.url}
      srcSet={image.srcSet}
      sizes={sizes}
      alt={alt}
      data-image={dataImage}
      draggable={draggable}
      loading={preloadIt ? "eager" : "lazy"}
      fetchPriority={fetchPriority}
      decoding="async"
      onLoad={() => setLoaded(true)}
      className={cn("absolute inset-0 h-full w-full", className)}
      style={
        image.blur && !loaded
          ? {
              backgroundImage: `url("${blurSvg(image)}")`,
              backgroundSize: "cover",
              backgroundPosition: "50% 50%",
              backgroundRepeat: "no-repeat",
            }
          : undefined
      }
    />
  );
}

/** next/image's blur-up: the tiny copy, smoothed by an SVG blur filter, as a data URL. */
function blurSvg({ blur, width, height }: ProductImage) {
  return (
    `data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${width} ${height}'%3E` +
    `%3Cfilter id='b' color-interpolation-filters='sRGB'%3E%3CfeGaussianBlur stdDeviation='20'/%3E` +
    `%3CfeColorMatrix values='1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 100 -1' result='s'/%3E` +
    `%3CfeFlood x='0' y='0' width='100%25' height='100%25'/%3E%3CfeComposite operator='out' in='s'/%3E` +
    `%3CfeComposite in2='SourceGraphic'/%3E%3CfeGaussianBlur stdDeviation='20'/%3E%3C/filter%3E` +
    `%3Cimage width='100%25' height='100%25' x='0' y='0' preserveAspectRatio='none' style='filter: url(%23b);' href='${blur}'/%3E%3C/svg%3E`
  );
}
