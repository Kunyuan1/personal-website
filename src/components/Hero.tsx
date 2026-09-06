"use client";

import Link from "next/link";

import { useEra } from "@/components/EraProvider";
import SystemCanvas from "@/components/SystemCanvas";
import { site } from "@/data/site";

const ERA_LABEL = {
  stable: { cjk: "恒纪元", en: "Stable Era", color: "text-sun-b", dot: "bg-sun-b" },
  chaotic: { cjk: "混沌纪元", en: "Chaotic Era", color: "text-sun-c", dot: "bg-sun-c" },
} as const;

export default function Hero() {
  const { era, civilization } = useEra();
  const label = ERA_LABEL[era];

  return (
    <section className="relative flex min-h-[calc(100svh-4rem)] flex-col justify-center overflow-hidden">
      <SystemCanvas className="absolute inset-0 h-full w-full" />

      {/* Keeps the type legible without hiding the system. On wide screens the
          text sits left and the orbits run clear on the right. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(5,6,10,0.35)_0%,rgba(5,6,10,0.82)_55%,rgba(5,6,10,0.92)_100%)] md:bg-[linear-gradient(to_right,rgba(5,6,10,0.95)_0%,rgba(5,6,10,0.86)_32%,rgba(5,6,10,0.3)_62%,rgba(5,6,10,0)_88%)]"
      />

      <div className="relative mx-auto w-full max-w-6xl px-6 py-20">
        {/* Instrument readout for the system running behind the text. */}
        <div className="mb-10 inline-flex flex-wrap items-center gap-3 border border-line bg-void/60 px-3 py-1.5 font-mono text-[11px] backdrop-blur-sm">
          <span className="relative flex h-1.5 w-1.5">
            <span
              className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-70 ${label.dot}`}
            />
            <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${label.dot}`} />
          </span>
          <span className="text-faint">
            <span className="cjk">文明</span>
            <span className="ml-2 uppercase tracking-[0.16em]">Civilization</span>{" "}
            #{civilization}
          </span>
          <span className="text-line-bright">·</span>
          <span className={label.color}>
            <span className="cjk">{label.cjk}</span>
            <span className="ml-2 uppercase tracking-[0.16em]">{label.en}</span>
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
            className="group inline-flex items-center gap-3 border border-accent/40 bg-accent/10 px-5 py-2.5 text-sm text-accent transition-colors hover:bg-accent/20"
          >
            View projects
            <span aria-hidden className="transition-transform group-hover:translate-x-1">
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
          Three suns and their worlds, integrated live. The Stable Era is a real
          periodic solution; the ringed world is Trisolaris, and a Chaotic Era
          destroys it more often than not.
        </p>
      </div>
    </section>
  );
}
