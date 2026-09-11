"use client";

import { usePathname } from "next/navigation";

import { useEra } from "@/components/EraProvider";
import type { CollapseCause } from "@/lib/trisolaris";

/**
 * What ended a civilisation — never what ended the world.
 *
 * Every line here used to be able to contradict the animation behind it. Two
 * of the five described Trisolaris being destroyed, and then the counter
 * calmly went to the next civilisation: the world fell into a sun, and there
 * was another one along in thirty seconds. In the books the planet is the one
 * thing that survives. Eleven siblings were swallowed; the twelfth carried two
 * hundred civilisations through fire, ice and dehydration and was still there.
 *
 * So these say what happened to the people. The world going on without them is
 * the point, and is why none of them claim it ended.
 */
const FATES: Record<CollapseCause, { cjk: string; text: string }> = {
  scorched: {
    cjk: "烈日",
    text: "The suns closed in and would not leave. Everything under them burned away.",
  },
  frozen: {
    cjk: "严寒",
    text: "The suns drew off, and the long night outlasted everyone sheltering under it.",
  },
  syzygy: {
    cjk: "三日连珠",
    text: "All three suns rose at once. The tri-solar day left nothing standing.",
  },
  drift: {
    cjk: "脱水",
    text: "The orbit never recovered. The civilization dehydrated, and did not wake.",
  },
};

/**
 * How long someone was gone, in the largest unit that still reads naturally.
 *
 * Deliberately coarse. "You have been in hibernation for 11 days" is the
 * sentence; "for 11 days, 4 hours and 12 minutes" is a receipt. Each threshold
 * overshoots its unit — 90 minutes before hours, 36 hours before days — so
 * nothing is ever announced as "1 hour" for 61 minutes, or "1 day" for someone
 * who stepped out after lunch.
 *
 * Every threshold reads `ms`, never the rounded value it is about to print,
 * and every branch handles the singular. Rounding first let the two disagree:
 * at 89 minutes 42 seconds `Math.round` gave 90 minutes, which failed the
 * `< 90` test, and the hour branch then printed "1 hours" — the exact output
 * the overshoot above was written to make impossible.
 */
function formatAway(ms: number): string {
  const plural = (value: number, unit: string) =>
    `${value.toLocaleString("en-US")} ${value === 1 ? unit : `${unit}s`}`;
  if (ms < 90 * 60000) return plural(Math.round(ms / 60000), "minute");
  if (ms < 36 * 3600000) return plural(Math.round(ms / 3600000), "hour");
  if (ms < 60 * 86400000) return plural(Math.round(ms / 86400000), "day");
  return plural(Math.round(ms / 86400000 / 30.44), "month");
}

/**
 * How a Chaotic Era ended — both ways.
 *
 * A Chaotic Era resolves into exactly one of two outcomes, and measured across
 * the report seeds the home world survives 25% of them. Only the deaths used to
 * be announced, so a survival was signalled by nothing at all: the same fade
 * from red to black, the same worlds fading back in, and no text. From the
 * outside that is indistinguishable from a disaster whose notice failed, which
 * is exactly how it was read.
 */
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
  // A hibernation takes neither colour. It is the one notice here that is not
  // reporting an outcome the animation just showed — it is about the visitor.
  const dormant = shown?.kind === "hibernation";
  // Nor does the descent, for the opposite reason: it is the only notice here
  // that is about something the animation is *still* showing.
  const descending = shown?.kind === "descent";

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
            dormant || descending
              ? "border-line-bright"
              : died
                ? "border-sun-c/30"
                : "border-sun-b/30"
          }`}
        >
          {shown.kind === "descent" ? (
            <>
              <span className="cjk block text-muted">降维</span>
              <span className="mt-2 block">
                Everything here began flat — the whole system pressed onto a single
                line — and is being given its dimensions back.
              </span>
              <span className="mt-2 block text-faint">
                In the books, this only ever runs the other way.
              </span>
            </>
          ) : shown.kind === "hibernation" ? (
            <>
              <span className="cjk block text-muted">冬眠</span>
              <span className="mt-2 block">
                You have been in hibernation for {formatAway(shown.awayMs)}. An estimated{" "}
                {shown.civilizations.toLocaleString("en-US")} civilizations rose and fell
                while you were dry.
              </span>
              <span className="mt-2 block text-faint">The system does not wait.</span>
            </>
          ) : (
            <>
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
            </>
          )}
        </p>
      )}
    </div>
  );
}
