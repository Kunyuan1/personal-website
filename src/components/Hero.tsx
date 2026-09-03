"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import ThreeBody, { type SimState } from "@/components/ThreeBody";
import { site } from "@/data/site";

const ERA_LABEL = {
  stable: { cjk: "恒纪元", en: "Stable Era", color: "text-sun-b", dot: "bg-sun-b" },
  chaotic: { cjk: "混沌纪元", en: "Chaotic Era", color: "text-sun-c", dot: "bg-sun-c" },
} as const;

export default function Hero() {
  const [sim, setSim] = useState<SimState>({ era: "stable", civilization: 1 });

  // Stable identity so the simulation's effect never re-runs.
  const handleState = useCallback((next: SimState) => setSim(next), []);

  const era = ERA_LABEL[sim.era];

  return (
    <section className="relative flex min-h-[calc(100svh-4rem)] flex-col justify-center overflow-hidden">
      <ThreeBody
        onStateChange={handleState}
        className="absolute inset-0 h-full w-full"
      />

      {/* Keeps the type legible without hiding the simulation. On wide screens
          the text sits left and the system runs clear on the right. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(5,6,10,0.35)_0%,rgba(5,6,10,0.82)_55%,rgba(5,6,10,0.92)_100%)] md:bg-[linear-gradient(to_right,rgba(5,6,10,0.95)_0%,rgba(5,6,10,0.86)_32%,rgba(5,6,10,0.3)_62%,rgba(5,6,10,0)_88%)]"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-void to-transparent"
      />

      <div className="relative mx-auto w-full max-w-6xl px-6 py-20">
        {/* Instrument readout for the simulation running behind the text. */}
        <div className="mb-10 inline-flex items-center gap-3 border border-line bg-void/60 px-3 py-1.5 font-mono text-[11px] backdrop-blur-sm">
          <span className="relative flex h-1.5 w-1.5">
            <span
              className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-70 ${era.dot}`}
            />
            <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${era.dot}`} />
          </span>
          <span className="text-faint">
            <span className="cjk">文明</span> #{sim.civilization}
          </span>
          <span className="text-line-bright">·</span>
          <span className={era.color}>
            <span className="cjk">{era.cjk}</span>
            <span className="ml-2 uppercase tracking-[0.16em]">{era.en}</span>
          </span>
        </div>

        <p className="eyebrow mb-5">
          {site.study} · {site.school}
        </p>

        <h1 className="text-6xl leading-[0.95] sm:text-8xl">
          {site.name}
          <span className="cjk mt-4 block text-2xl text-faint sm:text-3xl">
            {site.nameCjk}
          </span>
        </h1>

        <p className="mt-8 max-w-xl text-base leading-relaxed text-muted">
          {site.tagline}
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            href="/projects"
            className="group inline-flex items-center gap-3 border border-sun-a/40 bg-sun-a/10 px-5 py-2.5 text-sm text-sun-a transition-colors hover:bg-sun-a/20"
          >
            View projects
            <span
              aria-hidden
              className="transition-transform group-hover:translate-x-1"
            >
              →
            </span>
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center border border-line px-5 py-2.5 text-sm text-muted transition-colors hover:border-line-bright hover:text-ink"
          >
            Get in touch
          </Link>
        </div>

        <p className="mt-14 max-w-md font-mono text-[11px] leading-relaxed text-faint/80">
          Three equal masses under Newtonian gravity, integrated live. No closed-form
          solution — perturb the stable orbit and the system eventually tears itself
          apart.
        </p>
      </div>
    </section>
  );
}
