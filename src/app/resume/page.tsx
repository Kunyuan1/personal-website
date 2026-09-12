import PageHeader from "@/components/PageHeader";
import Reveal from "@/components/Reveal";
import { education, experience, type ResumeEntry } from "@/data/resume";
import { site } from "@/data/site";

export const metadata = {
  title: "Résumé",
  description: `Education and experience for ${site.name}, ${site.study} at the ${site.school}.`,
};

export default function ResumePage() {
  return (
    <>
      <PageHeader
        cjk="简历"
        eyebrow="Education & Experience"
        title="Résumé"
        intro="The short version. There's a PDF if you'd rather have it on one page."
      />

      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <Reveal>
          <a
            href={site.resumePdf}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-3 border border-accent/40 bg-accent/10 px-5 py-2.5 text-sm text-accent transition-colors hover:bg-accent/20"
          >
            Download résumé (PDF)
            <span aria-hidden className="transition-transform group-hover:translate-y-0.5">
              ↓
            </span>
          </a>
        </Reveal>

        <div className="mt-16 grid gap-16 md:grid-cols-2 md:gap-20">
          <Timeline cjk="教育" heading="Education" entries={education} />
          {experience.length > 0 && (
            <Timeline cjk="经历" heading="Experience" entries={experience} delay={120} />
          )}
        </div>
      </div>
    </>
  );
}

function Timeline({
  cjk,
  heading,
  entries,
  delay = 0,
}: {
  cjk: string;
  heading: string;
  entries: ResumeEntry[];
  delay?: number;
}) {
  return (
    <Reveal delay={delay}>
      <h2 className="flex items-baseline gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-faint">
        <span className="cjk">{cjk}</span>
        <span>{heading}</span>
      </h2>

      <ol className="mt-8 space-y-10 border-l border-line pl-7">
        {entries.map((entry) => (
          <li key={`${entry.organization}-${entry.title}`} className="relative">
            <span
              aria-hidden
              className="absolute -left-[1.9375rem] top-2 h-2 w-2 rounded-full border-2 border-void bg-accent"
            />

            <p className="font-mono text-[11px] text-faint">
              {entry.period}
              {entry.location && ` · ${entry.location}`}
            </p>

            <h3 className="mt-2 text-lg text-ink">{entry.title}</h3>
            <p className="mt-1 text-sm text-accent">{entry.organization}</p>

            <ul className="mt-4 space-y-2">
              {entry.points.map((point) => (
                <li key={point} className="flex gap-2.5 text-sm leading-relaxed text-muted">
                  <span
                    aria-hidden
                    className="mt-[0.5rem] h-1 w-1 shrink-0 rounded-full bg-faint"
                  />
                  {point}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </Reveal>
  );
}
