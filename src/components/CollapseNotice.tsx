"use client";

import { useEra } from "@/components/EraProvider";
import type { CollapseCause } from "@/lib/trisolaris";

/**
 * How each world died. The cause is read out of the simulation state at the
 * moment of destruction, so the notice always describes what actually
 * happened rather than picking a line at random.
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

export default function CollapseNotice() {
  const { collapse } = useEra();

  return (
    <div
      aria-live="polite"
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-6 pb-6 transition-all duration-700 ${
        collapse ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      }`}
    >
      {collapse && (
        <p className="max-w-md border border-sun-c/30 bg-void/90 px-5 py-3.5 text-center font-mono text-[11px] leading-relaxed text-muted backdrop-blur-sm">
          <span className="cjk block text-sun-c">
            文明 #{collapse.civilization} 已毁灭 · {FATES[collapse.cause].cjk}
          </span>
          <span className="mt-2 block">
            Civilization {collapse.civilization} was destroyed.{" "}
            {FATES[collapse.cause].text}
          </span>
          <span className="mt-2 block text-faint">
            The seed of civilization remains, and will germinate again.
          </span>
        </p>
      )}
    </div>
  );
}
