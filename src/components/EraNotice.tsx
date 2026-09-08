"use client";

import { usePathname } from "next/navigation";

import { useEra } from "@/components/EraProvider";
import type { CollapseCause } from "@/lib/trisolaris";

/**
 * How a Chaotic Era ended — both ways.
 *
 * A Chaotic Era resolves into exactly one of two outcomes, and measured across
 * the report seeds the home world survives 34% of them. Only the deaths used to
 * be announced, so a survival was signalled by nothing at all: the same fade
 * from red to black, the same worlds fading back in, and no text. From the
 * outside that is indistinguishable from a disaster whose notice failed, which
 * is exactly how it was read.
 */
const FATES: Record<CollapseCause, { cjk: string; text: string }> = {
  fire: {
    cjk: "烈焰",
    text: "The world fell into a sun and burned.",
  },
  syzygy: {
    cjk: "三日连珠",
    text: "All three suns rose together. The world was consumed by the tri-solar day.",
  },
  cold: {
    cjk: "严寒",
    text: "The world was flung out of the system, into the cold of the outer dark.",
  },
  starless: {
    cjk: "恒星流散",
    text: "One of the suns escaped, and the world froze in the long night that followed.",
  },
  drift: {
    cjk: "脱水",
    text: "The orbit never recovered. The civilization dehydrated, and did not wake.",
  },
};

export default function EraNotice() {
  // `notice` is the text and `noticeVisible` is whether it is up. They are
  // separate so the panel can fade out with its words still in it: unmounting
  // the text in the same commit that starts the wrapper's 700ms fade cut the
  // panel off mid-sentence and slid an empty div away behind it. Entry
  // animated, exit did not.
  const { notice: shown, noticeVisible } = useEra();
  const pathname = usePathname();

  // Crimson for a death, blue for a survival — the same two colours the era
  // badge already uses for Chaotic and Stable, so the notice needs no reading
  // to be placed. Read off `shown`, so the colour survives the fade-out.
  const died = shown?.kind === "collapse";

  // The notice narrates the system in the hero, and only `/` renders Hero.
  // Everywhere else it was a panel describing a simulation with nothing on
  // screen to attach it to; announcing survivals as well as deaths roughly
  // doubles how often it appears, which is what made that worth fixing.
  if (pathname !== "/") return null;

  return (
    <div
      aria-live="polite"
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-6 pb-6 transition-all duration-700 ${
        noticeVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      }`}
    >
      {shown && (
        <p
          className={`max-w-md border bg-void/90 px-5 py-3.5 text-center font-mono text-[11px] leading-relaxed text-muted backdrop-blur-sm ${
            died ? "border-sun-c/30" : "border-sun-b/30"
          }`}
        >
          <span className={`cjk block ${died ? "text-sun-c" : "text-sun-b"}`}>
            文明 #{shown.civilization}{" "}
            {shown.kind === "collapse"
              ? `已毁灭 · ${FATES[shown.cause].cjk}`
              : "存续"}
          </span>
          <span className="mt-2 block">
            {shown.kind === "collapse"
              ? `Civilization ${shown.civilization} was destroyed. ${FATES[shown.cause].text}`
              : `Civilization ${shown.civilization} survived the Chaotic Era.`}
          </span>
          <span className="mt-2 block text-faint">
            {died
              ? "The seed of civilization remains, and will germinate again."
              : "The suns returned to their courses, and the world held its orbit."}
          </span>
        </p>
      )}
    </div>
  );
}
