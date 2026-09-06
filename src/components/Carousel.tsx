"use client";

import Image, { type StaticImageData } from "next/image";
import { useCallback, useRef, useState } from "react";

type Props = {
  images: { src: StaticImageData; alt: string }[];
  /** Eager-loads the first slide — set on the project above the fold. */
  priority?: boolean;
};

const SWIPE_THRESHOLD = 40;

export default function Carousel({ images, priority = false }: Props) {
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const count = images.length;

  const go = useCallback(
    (next: number) => setIndex(((next % count) + count) % count),
    [count],
  );

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      go(index - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      go(index + 1);
    }
  };

  const onTouchEnd = (event: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = event.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(delta) > SWIPE_THRESHOLD) go(index + (delta < 0 ? 1 : -1));
    touchStartX.current = null;
  };

  return (
    <div
      role="group"
      aria-roledescription="carousel"
      aria-label="Project screenshots"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onTouchStart={(e) => (touchStartX.current = e.touches[0].clientX)}
      onTouchEnd={onTouchEnd}
      className="group relative overflow-hidden border border-line bg-deep"
    >
      {/* Screenshots vary in aspect ratio, so they're contained rather than
          cropped and the frame keeps one consistent shape down the page. */}
      <div className="relative aspect-[16/10]">
        {images.map((image, i) => (
          <Image
            key={image.src.src}
            src={image.src}
            alt={image.alt}
            placeholder="blur"
            sizes="(max-width: 768px) 100vw, 50vw"
            priority={priority && i === 0}
            aria-hidden={i !== index}
            className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-500 ${
              i === index ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}
      </div>

      {count > 1 && (
        <>
          <Arrow side="left" onClick={() => go(index - 1)} />
          <Arrow side="right" onClick={() => go(index + 1)} />

          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-3">
            <div className="pointer-events-auto flex items-center gap-1.5 border border-line bg-void/85 px-2.5 py-1.5 backdrop-blur-sm">
              {images.map((image, i) => (
                <button
                  key={image.src.src}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Show screenshot ${i + 1} of ${count}`}
                  aria-current={i === index}
                  className={`h-1 transition-all ${
                    i === index ? "w-5 bg-accent" : "w-2 bg-faint/50 hover:bg-faint"
                  }`}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Arrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous screenshot" : "Next screenshot"}
      className={`absolute top-1/2 z-10 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center border border-line bg-void/85 text-muted opacity-0 backdrop-blur-sm transition hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-100 ${
        side === "left" ? "left-3" : "right-3"
      }`}
    >
      {side === "left" ? "‹" : "›"}
    </button>
  );
}
