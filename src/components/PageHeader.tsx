import Reveal from "./Reveal";

type Props = {
  /** Chinese label, shown before the English eyebrow. */
  cjk: string;
  eyebrow: string;
  title: string;
  intro?: string;
};

/** The masthead every page opens with, so they read as one set. */
export default function PageHeader({ cjk, eyebrow, title, intro }: Props) {
  return (
    <header className="relative border-b border-line">
      <div className="starfield pointer-events-none absolute inset-0 opacity-40" aria-hidden />

      <div className="relative mx-auto max-w-6xl px-6 pb-16 pt-20 sm:pb-20 sm:pt-28">
        <Reveal>
          <p className="eyebrow flex items-center gap-3">
            <span className="cjk text-accent">{cjk}</span>
            <span className="h-px w-8 bg-line-bright" aria-hidden />
            {eyebrow}
          </p>
        </Reveal>

        <Reveal delay={80}>
          <h1 className="mt-6 text-5xl leading-[1.02] sm:text-7xl">{title}</h1>
        </Reveal>

        {intro && (
          <Reveal delay={160}>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted">{intro}</p>
          </Reveal>
        )}
      </div>
    </header>
  );
}
