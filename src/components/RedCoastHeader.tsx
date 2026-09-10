"use client";

import { useEra } from "@/components/EraProvider";

/**
 * The console above the contact channels.
 *
 * Red Coast Base is the setup the dark-forest line at the bottom of this page
 * has always been the punchline to: a dish in Inner Mongolia using the sun as
 * a gain antenna, a message sent into the dark, and eight years later a reply
 * telling her not to send another. A contact page is the same act — a message
 * to someone you do not know, hoping for an answer — so the framing was
 * already true here, it just was not said.
 *
 * Live rather than static, and this is the only reason the page needs any
 * client JavaScript at all. The readout is the same simulation the hero runs,
 * so the gain line goes unstable exactly when the suns do, and the era and
 * civilisation match the badge on the front page rather than describing a
 * second, invented one.
 *
 * Nothing here degrades badly before hydration. `EraProvider` starts every
 * session in a Stable Era at civilisation 1, and those are the values the
 * server renders, so the first paint is a complete, truthful console that
 * corrects itself to this visitor's own history a frame later. There is no
 * empty state to flash and nothing that changes size when it fills in.
 */
export default function RedCoastHeader() {
  const { era, civilization } = useEra();
  const chaotic = era === "chaotic";

  return (
    <div className="border border-line bg-surface/60 px-5 py-4 font-mono text-[11px] leading-relaxed">
      <p className="uppercase tracking-[0.18em] text-faint">
        <span className="cjk mr-2 normal-case tracking-normal text-ink">红岸</span>
        Red Coast Transmission
      </p>

      <p className="mt-2 text-faint/70">
        Carrier: solar amplification
        <span className="mx-2 text-line-bright">·</span>
        {/* The one line that moves. Read from the same system as the hero, so
            it says "unstable" while the suns are actually being thrown about
            rather than on a schedule of its own. */}
        <span className={chaotic ? "text-sun-c" : undefined}>
          Gain {chaotic ? "unstable" : "nominal"}
        </span>
      </p>

      <p className="mt-1 text-faint/70">
        Era: {chaotic ? "Chaotic" : "Stable"}
        <span className="mx-2 text-line-bright">·</span>
        Civilization #{civilization}
      </p>
    </div>
  );
}
