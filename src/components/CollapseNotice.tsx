"use client";

import { useEra } from "@/components/EraProvider";

/**
 * Announces the end of a civilisation, in the book's own framing. Sits at the
 * bottom of the viewport and never covers content, so it can be ignored.
 */
export default function CollapseNotice() {
  const { collapsedCivilization } = useEra();
  const visible = collapsedCivilization !== null;

  return (
    <div
      aria-live="polite"
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-6 pb-6 transition-all duration-700 ${
        visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      }`}
    >
      {visible && (
        <p className="max-w-md border border-sun-c/30 bg-void/90 px-5 py-3 text-center font-mono text-[11px] leading-relaxed text-muted backdrop-blur-sm">
          <span className="cjk text-sun-c">
            文明 #{collapsedCivilization} 已毁灭
          </span>
          <span className="mt-1.5 block">
            Civilization {collapsedCivilization} was destroyed. The seed of
            civilization remains, and will germinate again.
          </span>
        </p>
      )}
    </div>
  );
}
