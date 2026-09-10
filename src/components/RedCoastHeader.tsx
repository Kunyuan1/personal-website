"use client";

import { useEra } from "@/components/EraProvider";
import { ERA_LABEL } from "@/lib/era-label";

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
 *
 * The cost of being live, in full: a third state. Static text cannot go stale
 * and live text can, and `departed` below is the one state this readout could
 * otherwise never leave.
 */
export default function RedCoastHeader() {
  const { era, civilization, departed } = useEra();
  const label = ERA_LABEL[era];
  const chaotic = era === "chaotic";

  return (
    <div className="border border-line bg-surface/60 px-5 py-4 font-mono text-[11px] leading-relaxed">
      <p className="uppercase tracking-[0.18em] text-faint">
        <span className="cjk mr-2 normal-case tracking-normal text-ink">红岸</span>
        Red Coast Transmission
      </p>

      {/*
        Three states, not two.

        A departure can only happen inside a Chaotic Era — `lost` is pushed from
        the chaotic branch of `advance` — and a departed system then skips every
        era transition for good, so `sys.era` is frozen at "chaotic" from that
        moment on. Read as two states, this console spent the rest of the
        session holding a crimson `Gain unstable` over a page whose heat had
        decayed to black, about a system with nothing left to be unstable: the
        one element here whose whole premise is that it is live was the only one
        that could never update again.
      */}
      {departed ? (
        <>
          <p className="mt-2 text-faint">
            Carrier: none
            <span className="mx-2 text-line-bright">·</span>
            Signal lost
          </p>
          <p className="mt-1 text-faint">Last transmission: civilization #{civilization}</p>
        </>
      ) : (
        <>
          <p className="mt-2 text-faint">
            Carrier: solar amplification
            <span className="mx-2 text-line-bright">·</span>
            {/* The one line that moves. Read from the same system as the hero,
                so it says "unstable" while the suns are actually being thrown
                about rather than on a schedule of its own. */}
            <span className={chaotic ? label.color : undefined}>
              Gain {chaotic ? "unstable" : "nominal"}
            </span>
          </p>

          <p className="mt-1 text-faint">
            {/* Coloured the way the hero colours its badge: the era takes the
                era's colour and the number beside it stays quiet. */}
            Era: <span className={label.color}>{label.short}</span>
            <span className="mx-2 text-line-bright">·</span>
            Civilization #{civilization}
          </p>
        </>
      )}
    </div>
  );
}
