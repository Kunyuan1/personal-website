import PageHeader from "@/components/PageHeader";
import Reveal from "@/components/Reveal";
import { site } from "@/data/site";
import { skillGroups } from "@/data/skills";

export const metadata = {
  title: "About",
  description: `${site.study} at the ${site.school}. Game development, real-time systems and AI.`,
};

const facts = [
  { label: "Studying", cjk: "专业", value: site.study },
  { label: "At", cjk: "学校", value: site.school },
  { label: "Based in", cjk: "所在", value: site.location },
  { label: "Into", cjk: "爱好", value: "Game dev, AI, lifting, singing" },
];

export default function AboutPage() {
  return (
    <>
      <PageHeader
        cjk="关于"
        eyebrow="Who I Am"
        title="About"
        intro="Developer, student, and someone who keeps starting projects to find out how something works."
      />

      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <div className="grid gap-14 md:grid-cols-[1.5fr_1fr] md:gap-20">
          <Reveal className="space-y-6">
            {/* 焜 means bright, or shining — which is a strange coincidence for
                someone who ended up putting three suns on his front page. */}
            <p className="text-lg leading-relaxed text-ink">
              I&apos;m Kunyuan. The 焜 in my name means{" "}
              <span className="text-accent">bright</span> — it&apos;s built on the
              character for fire. I didn&apos;t plan the three suns on the front
              page around that, but I&apos;m not going to pretend it isn&apos;t
              fitting.
            </p>

            <p className="text-base leading-relaxed text-muted">
              I study computer science and statistics at the University of Toronto
              Mississauga, and most of what I build sits where those two overlap:
              game development and artificial intelligence. Simulation, systems that
              have to keep several people in step at once, and interfaces that make a
              hard thing feel easy.
            </p>

            <p className="text-base leading-relaxed text-muted">
              Most projects start as a question I want answered. What makes a game
              loop worth replaying. What a scheduling system looks like when
              it&apos;s actually designed around the patient. How bad an interface
              can get before it stops being funny — that one turned into a real
              project.
            </p>

            <p className="text-base leading-relaxed text-muted">
              Away from a keyboard I&apos;m at the gym, playing games, or singing.
              And I maintain that thin noodles are better than thick ones, which is
              the only position on this site I&apos;d actually argue about.
            </p>
          </Reveal>

          <Reveal delay={120}>
            <dl className="border border-line bg-surface p-7">
              {facts.map((fact, index) => (
                <div
                  key={fact.label}
                  className={index === 0 ? "" : "mt-6 border-t border-line pt-6"}
                >
                  <dt className="flex items-baseline gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
                    <span className="cjk">{fact.cjk}</span>
                    <span>{fact.label}</span>
                  </dt>
                  <dd className="mt-2 text-sm leading-relaxed text-ink">{fact.value}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </div>

      <section className="border-t border-line bg-deep">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
          <Reveal>
            <p className="eyebrow flex items-center gap-3">
              <span className="cjk text-accent">技能</span>
              <span className="h-px w-8 bg-line-bright" aria-hidden />
              What I work with
            </p>
            <h2 className="mt-5 text-3xl sm:text-4xl">The stack</h2>
          </Reveal>

          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {skillGroups.map((group, index) => (
              <Reveal key={group.label} delay={index * 100}>
                <div className="h-full border border-line bg-surface p-6">
                  <h3 className="flex items-baseline gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-faint">
                    <span className="cjk">{group.cjk}</span>
                    <span>{group.label}</span>
                  </h3>
                  <ul className="mt-5 flex flex-wrap gap-2">
                    {group.items.map((item) => (
                      <li
                        key={item}
                        className="border border-line px-2.5 py-1.5 text-sm text-ink transition-colors hover:border-accent hover:text-accent"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
