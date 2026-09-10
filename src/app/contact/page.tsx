import PageHeader from "@/components/PageHeader";
import RedCoastHeader from "@/components/RedCoastHeader";
import Reveal from "@/components/Reveal";
import { site } from "@/data/site";

export const metadata = {
  title: "Contact",
  description: `Get in touch with ${site.name} — email, GitHub, LinkedIn.`,
};

const channels = [
  {
    label: "Email",
    cjk: "邮箱",
    value: site.email,
    href: `mailto:${site.email}`,
    band: "high-gain link · direct",
  },
  {
    label: "GitHub",
    cjk: "代码",
    value: "@Kunyuan1",
    href: site.github,
    band: "open archive · broadcasting continuously",
  },
  {
    label: "LinkedIn",
    cjk: "领英",
    value: "Kunyuan Hu",
    href: site.linkedin,
    band: "formal channel",
  },
  {
    label: "Instagram",
    cjk: "照片",
    value: "@kunyuan_hu",
    href: site.instagram,
    band: "unencrypted civilian traffic",
  },
];

export default function ContactPage() {
  return (
    <>
      <PageHeader
        cjk="联系"
        eyebrow="Get in Touch"
        title="Contact"
        intro="Open to internships, collaborations, or just talking about something you're building."
      />

      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        {/* The setup. See RedCoastHeader — the line at the foot of this
            page has been the punchline to it for some time. */}
        <Reveal>
          <RedCoastHeader />
        </Reveal>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {channels.map((channel, index) => {
            const external = channel.href.startsWith("http");
            return (
              <Reveal key={channel.label} delay={index * 90}>
                <a
                  href={channel.href}
                  {...(external
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                  className="group flex h-full items-start justify-between gap-6 border border-line bg-surface p-7 transition-colors hover:border-accent"
                >
                  <span className="min-w-0">
                    <span className="flex items-baseline gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-faint">
                      <span className="cjk">{channel.cjk}</span>
                      <span>{channel.label}</span>
                    </span>
                    <span className="mt-2.5 block truncate text-base text-ink">
                      {channel.value}
                    </span>
                    <span className="mt-1.5 block font-mono text-[11px] text-faint/70">
                      {channel.band}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className="shrink-0 text-faint transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent"
                  >
                    ↗
                  </span>
                </a>
              </Reveal>
            );
          })}
        </div>

        {/* The reply Ye Wenjie got, and what she did about it. The console
            above is the transmission this is the answer to. */}
        <Reveal delay={400}>
          <p className="mt-16 max-w-md font-mono text-[11px] leading-relaxed text-faint/70">
            <span className="cjk">不要回答</span> · Do not answer. The universe is a
            dark forest, and broadcasting your position is generally inadvisable —
            but this one is fine, I checked.
          </p>
        </Reveal>
      </div>
    </>
  );
}
