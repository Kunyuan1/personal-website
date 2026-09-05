import Carousel from "@/components/Carousel";
import PageHeader from "@/components/PageHeader";
import Reveal from "@/components/Reveal";
import { projects, type Project } from "@/data/projects";

export const metadata = {
  title: "Projects",
  description:
    "Games, real-time systems and interfaces built by Kunyuan Hu — with source on GitHub.",
};

export default function ProjectsPage() {
  return (
    <>
      <PageHeader
        cjk="档案"
        eyebrow="The Archive"
        title="Projects"
        intro="Four things built to answer a question I had. Every one is on GitHub if you'd rather read the code than take my word for it."
      />

      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <div className="space-y-24 sm:space-y-32">
          {projects.map((project, index) => (
            <ProjectRow key={project.slug} project={project} index={index} />
          ))}
        </div>
      </div>
    </>
  );
}

function ProjectRow({ project, index }: { project: Project; index: number }) {
  const flipped = index % 2 === 1;

  return (
    <Reveal>
      <article className="grid items-center gap-10 md:grid-cols-2 md:gap-14">
        <div className={flipped ? "md:order-2" : ""}>
          {project.images.length > 0 ? (
            <Carousel images={project.images} priority={index === 0} />
          ) : (
            <NoShots project={project} />
          )}
        </div>

        <div className={flipped ? "md:order-1" : ""}>
          <div className="flex items-baseline gap-4">
            <span className="font-mono text-sm text-accent">{project.num}</span>
            <span className="h-px flex-1 bg-line" aria-hidden />
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-faint">
              {project.kind}
            </span>
          </div>

          <h2 className="mt-5 text-3xl sm:text-4xl">{project.title}</h2>
          <p className="mt-2 text-base text-accent">{project.summary}</p>

          <p className="mt-5 text-base leading-relaxed text-muted">
            {project.description}
          </p>

          <ul className="mt-6 space-y-2.5">
            {project.highlights.map((highlight) => (
              <li key={highlight} className="flex gap-3 text-sm leading-relaxed text-muted">
                <span
                  aria-hidden
                  className="mt-[0.5rem] h-1 w-1 shrink-0 rounded-full bg-accent"
                />
                {highlight}
              </li>
            ))}
          </ul>

          <ul className="mt-7 flex flex-wrap gap-2">
            {project.tech.map((tech) => (
              <li
                key={tech}
                className="border border-line px-2.5 py-1 font-mono text-[11px] text-muted"
              >
                {tech}
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap gap-3">
            {project.live && (
              <a
                href={project.live}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 border border-accent/40 bg-accent/10 px-4 py-2 text-sm text-accent transition-colors hover:bg-accent/20"
              >
                Play it live
                <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
                  ↗
                </span>
              </a>
            )}
            <a
              href={project.github}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex items-center gap-2 border border-line px-4 py-2 text-sm text-muted transition-colors hover:border-line-bright hover:text-ink"
            >
              Source
              <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
                ↗
              </span>
            </a>
          </div>
        </div>
      </article>
    </Reveal>
  );
}

/**
 * Stands in where a project has no screenshots yet. Deliberately not a grey
 * box: it shows the stack, so the space still says something.
 */
function NoShots({ project }: { project: Project }) {
  return (
    <div className="flex aspect-[16/10] flex-col justify-between border border-line bg-deep p-7">
      <div className="flex items-center gap-2" aria-hidden>
        <span className="h-2 w-2 rounded-full bg-sun-a/60" />
        <span className="h-2 w-2 rounded-full bg-sun-b/60" />
        <span className="h-2 w-2 rounded-full bg-sun-c/60" />
      </div>

      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-faint">
          Stack
        </p>
        <p className="mt-3 font-display text-2xl leading-snug text-ink">
          {project.tech.join("  ·  ")}
        </p>
      </div>

      <p className="font-mono text-[11px] text-faint">
        {project.live ? "Playable in the browser →" : "Source on GitHub →"}
      </p>
    </div>
  );
}
