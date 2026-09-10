import type { Era } from "@/lib/trisolaris";

/**
 * How an era is named and coloured, everywhere it is shown.
 *
 * One table rather than one per readout. It lived in `Hero` while the hero was
 * the only thing displaying an era; the contact console then re-derived the
 * same two facts as a pair of ternaries, so renaming "Chaotic Era" or adding a
 * third era would have updated the badge and quietly left the console behind.
 *
 * Here rather than in `Hero` so that importing it does not drag the hero — and
 * with it `SystemCanvas` — into the bundle of every page that wants to name an
 * era. It carries Tailwind classes, so it deliberately does not live in
 * `trisolaris.ts`, which knows nothing about how any of this is drawn.
 */
export const ERA_LABEL = {
  stable: { cjk: "恒纪元", en: "Stable Era", short: "Stable", color: "text-sun-b", dot: "bg-sun-b" },
  chaotic: {
    cjk: "混沌纪元",
    en: "Chaotic Era",
    short: "Chaotic",
    color: "text-sun-c",
    dot: "bg-sun-c",
  },
} as const satisfies Record<Era, unknown>;
