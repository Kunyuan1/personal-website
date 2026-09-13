/**
 * Exercises the arrival sequence's decision table.
 *
 * The script this checks is a string of ES5 in `src/app/layout.tsx`, run as a
 * blocking `<script>` in `<head>` before anything is painted. Nothing else in
 * the site is written that way and nothing else is as hard to see fail: every
 * wrong answer it can give produces a page that works perfectly and simply
 * does not play, which is indistinguishable from a design decision unless you
 * knew the sequence was meant to be there.
 *
 * It has now shipped that failure twice. `if(document.hidden)return` read a
 * prerendering document as a background tab and ate the intro for every
 * visitor who typed the address; the fix then capped the prerender wait with
 * the same `end()` the tear uses and ate it again for anyone slow to press
 * Enter. Both were one line, both were invisible in a browser, and the second
 * was written by someone who had just spent an afternoon on the first.
 *
 * So the table below is the check, not the mechanism. It asserts what the
 * script decides for each way a visitor can arrive, against a stubbed DOM and
 * a clock this file advances by hand — which is what makes a 30s cap testable
 * in under a millisecond, and what the browser cannot easily be made to show:
 * Chrome will not prerender into a hidden tab, so the path that caused all of
 * this is not reachable from a preview. Run with `npm run check:intro`.
 *
 * The script source is extracted from `layout.tsx` rather than duplicated. A
 * second copy kept in sync by hand would pass this file long after the site
 * stopped agreeing with it.
 */
import { readFileSync } from "node:fs";
import vm from "node:vm";

const SOURCE = "src/app/layout.tsx";
const DECLARATION = /const introScript = `([\s\S]*?)`;\r?\n/;

const declaration = readFileSync(SOURCE, "utf8").match(DECLARATION);
if (!declaration) {
  console.error(
    `${SOURCE}: no \`const introScript = \`...\`\` found. If the script moved or `,
    "was renamed, this check is now testing nothing — point it at the new home.",
  );
  process.exit(1);
}
const script = declaration[1];

/**
 * The parts of a browser the script actually touches, and nothing else.
 *
 * Deliberately not jsdom. The script reads six globals and two custom
 * properties; a real DOM implementation would add a dependency, a lot of
 * behaviour nobody here is asserting, and no way at all to sit at t=29s.
 */
function arrive({
  path = "/",
  hidden = false,
  prerendering = false,
  reduced = false,
  // A browser that will not tell the script how long its own sequence is:
  // a hardened `getComputedStyle`, a privacy extension, a patched global.
  unreadableStyles = false,
} = {}) {
  let now = 0;
  let nextTimer = 0;
  const timers = new Map();
  const listeners = { document: {}, window: {} };
  const attributes = new Map();

  const add = (bag) => (type, fn) => ((bag[type] ??= new Set()).add(fn));
  const remove = (bag) => (type, fn) => bag[type]?.delete(fn);

  const root = {
    setAttribute: (name, value) => attributes.set(name, value),
    removeAttribute: (name) => attributes.delete(name),
  };

  const doc = {
    documentElement: root,
    get hidden() {
      return hidden;
    },
    prerendering,
    addEventListener: add(listeners.document),
    removeEventListener: remove(listeners.document),
  };

  const win = {
    document: doc,
    matchMedia: () => ({ matches: reduced }),
    addEventListener: add(listeners.window),
    removeEventListener: remove(listeners.window),
    scrollTo: () => {},
  };

  const sandbox = {
    document: doc,
    window: win,
    location: { pathname: path },
    // The two knobs the script reads out of the cascade, at the values
    // `globals.css` declares. If those move, this moves with them.
    getComputedStyle: () => {
      if (unreadableStyles) throw new Error("no computed styles for you");
      return {
        getPropertyValue: (name) =>
          ({ "--intro-hold": "3000ms", "--intro-glitch": "560ms" })[name] ?? "",
      };
    },
    setTimeout: (fn, ms) => {
      timers.set(++nextTimer, { at: now + ms, fn });
      return nextTimer;
    },
    clearTimeout: (id) => timers.delete(id),
  };

  vm.createContext(sandbox);
  vm.runInContext(script, sandbox);

  return {
    /** What the curtain is doing: "wait", "on", or null for gone. */
    curtain: () => attributes.get("data-intro") ?? null,
    listening: (where, type) => (listeners[where][type]?.size ?? 0) > 0,
    fire(type, event = {}) {
      for (const fn of [...(listeners.document[type] ?? [])]) fn(event);
    },
    /**
     * The prerender is claimed.
     *
     * `prerendering` goes false *before* `prerenderingchange` fires — that is
     * what the event announces — so the two are set here rather than by the
     * caller firing the event. Getting this backwards is how the first draft
     * of this file asserted a state no browser can produce.
     *
     * Activation normally brings the tab to the front; `visible: false` is the
     * odd case where it does not.
     */
    activate({ visible = true } = {}) {
      doc.prerendering = false;
      hidden = !visible;
    },
    /** The visitor gets round to looking at the tab. */
    show() {
      hidden = false;
    },
    /** Run the clock forward, firing timers in order as their time comes. */
    advance(ms) {
      const until = now + ms;
      for (;;) {
        const due = [...timers.entries()]
          .filter(([, timer]) => timer.at <= until)
          .sort(([, a], [, b]) => a.at - b.at)[0];
        if (!due) break;
        const [id, timer] = due;
        timers.delete(id);
        now = timer.at;
        timer.fn();
      }
      now = until;
    },
  };
}

const TEAR = { animationName: "intro-tear" };
/** Hold, plus tear, plus the margin `start` adds to its own safety timeout. */
const WHOLE_SEQUENCE = 3000 + 560 + 1500;

let failures = 0;
function check(what, actual, expected) {
  const ok = Object.is(actual, expected);
  if (!ok) failures += 1;
  console.log(
    `  ${ok ? "ok  " : "FAIL"}  ${what}` +
      (ok ? "" : `\n        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`),
  );
}

console.log("\nan ordinary arrival");
{
  const visit = arrive();
  check("curtain is up before anything paints", visit.curtain(), "on");
  check("scrolling is pinned", visit.listening("window", "scroll"), true);
  visit.fire("animationend", TEAR);
  check("the tear takes it down", visit.curtain(), null);
  check("the scroll pin is released", visit.listening("window", "scroll"), false);
}

console.log("\nan arrival nobody is looking at");
{
  const visit = arrive({ hidden: true });
  check("a background tab gets no curtain", visit.curtain(), null);
  check("and nothing is left listening for one", visit.listening("document", "visibilitychange"), false);
}

console.log("\nan address typed into the omnibox");
{
  const visit = arrive({ hidden: true, prerendering: true });
  check("the curtain goes up while prerendering", visit.curtain(), "wait");
  check("but the clock is held", visit.listening("window", "scroll"), false);
  visit.activate();
  visit.fire("prerenderingchange");
  check("activation starts the sequence", visit.curtain(), "on");
  check("and pins the scroll", visit.listening("window", "scroll"), true);
  visit.fire("animationend", TEAR);
  check("the tear takes it down", visit.curtain(), null);
}

console.log("\nthe same, from a browser that activates without saying so");
{
  const visit = arrive({ hidden: true, prerendering: true });
  visit.activate();
  visit.fire("visibilitychange");
  check("the fallback signal starts it", visit.curtain(), "on");
}

console.log("\na prerender the visitor is slow to claim");
{
  const visit = arrive({ hidden: true, prerendering: true });
  visit.advance(29000);
  check("still waiting at 29s", visit.curtain(), "wait");
  visit.advance(2000);
  check("the cap lowers the curtain at 30s", visit.curtain(), null);
  visit.activate();
  visit.fire("prerenderingchange");
  // The regression this file was written for. Ending the sequence at the cap
  // rather than merely lowering the curtain left `done` set, and a visitor who
  // paused half a minute before pressing Enter got the bug back in full.
  check("a late arrival still plays", visit.curtain(), "on");
  visit.fire("animationend", TEAR);
  check("and still ends", visit.curtain(), null);
}

console.log("\na prerender handed to a tab that is still hidden");
{
  const visit = arrive({ hidden: true, prerendering: true });
  // Activation is authoritative: this is the background-tab case by another
  // road, so it refuses rather than deferring. Dropping a curtain over a page
  // already sitting rendered in the tab is the outcome being avoided.
  visit.activate({ visible: false });
  visit.fire("prerenderingchange");
  check("the curtain comes down", visit.curtain(), null);
  visit.show();
  visit.fire("visibilitychange");
  check("and focusing the tab later does not raise it", visit.curtain(), null);
}

console.log("\nthe sequence ends even when nothing animates");
{
  const visit = arrive();
  visit.advance(WHOLE_SEQUENCE - 1);
  check("not before its time", visit.curtain(), "on");
  visit.advance(1);
  check("the timeout ends a tear that never ran", visit.curtain(), null);
}

console.log("\narrivals the sequence is not for");
{
  check("a deep link", arrive({ path: "/projects" }).curtain(), null);
  check(
    "a deep link being prerendered",
    arrive({ path: "/projects", prerendering: true, hidden: true }).curtain(),
    null,
  );
  check("someone who asked for less motion", arrive({ reduced: true }).curtain(), null);
  check(
    "the same, being prerendered",
    arrive({ reduced: true, prerendering: true, hidden: true }).curtain(),
    null,
  );
}

console.log("\na browser that will not say how long the sequence is");
{
  // `start` runs from a listener on the prerender path, outside the IIFE's
  // `try`, so a throw between raising the curtain and scheduling the safety
  // timeout would leave `animationend` as the only way out — the single point
  // of failure that timeout was added to remove. The measurement is wrapped;
  // the timeout is scheduled either way, on the documented fallback.
  const visit = arrive({ hidden: true, prerendering: true, unreadableStyles: true });
  visit.activate();
  visit.fire("prerenderingchange");
  check("the curtain still goes up", visit.curtain(), "on");
  visit.advance(6499);
  check("and is still up just before the fallback", visit.curtain(), "on");
  visit.advance(1);
  check("the fallback timeout takes it down", visit.curtain(), null);
}

console.log("\nboth signals arriving");
{
  const visit = arrive({ hidden: true, prerendering: true });
  visit.activate();
  visit.fire("prerenderingchange");
  visit.fire("visibilitychange");
  check("the second is a no-op", visit.curtain(), "on");
  visit.fire("animationend", TEAR);
  check("and the tear still ends it once", visit.curtain(), null);
}

console.log(
  failures ? `\n${failures} arrival${failures === 1 ? "" : "s"} decided wrongly\n` : "\nall arrivals decided correctly\n",
);
process.exit(failures ? 1 : 0);
