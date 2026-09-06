import type { StaticImageData } from "next/image";

import mediFront from "@/assets/medi-cal/front.png";
import mediLogin from "@/assets/medi-cal/login.png";
import mediServices from "@/assets/medi-cal/services.png";
import mediLifestyle from "@/assets/medi-cal/lifestyle.png";
import mediSchedule from "@/assets/medi-cal/schedule.png";
import mediBooking from "@/assets/medi-cal/booking.png";

import gameFront from "@/assets/erics-mansion/game_front.png";
import gameStart from "@/assets/erics-mansion/game_start.png";
import gameBasement from "@/assets/erics-mansion/game_basement.png";
import gameLiving from "@/assets/erics-mansion/game_living.png";

import birthdayInput from "@/assets/worst-birthday/birthday_input.png";
import birthdayBlackjack from "@/assets/worst-birthday/birthday_blackjack.png";
import birthdayCalculator from "@/assets/worst-birthday/birthday_calculator.png";

export type Project = {
  num: string;
  slug: string;
  title: string;
  /** Short category plus year, shown above the title. */
  kind: string;
  /** One line that says why it exists. */
  summary: string;
  description: string;
  /** Two or three concrete things it does. */
  highlights: string[];
  tech: string[];
  github: string;
  live?: string;
  images: { src: StaticImageData; alt: string }[];
};

/**
 * Descriptions and tech tags were checked against each repository's source
 * rather than copied forward, after the previous site mislabelled two of them.
 */
export const projects: Project[] = [
  {
    num: "01",
    slug: "imposter",
    title: "Imposter",
    kind: "Real-Time Multiplayer · 2026",
    summary: "A party game that has to stay in sync across every phone in the room.",
    description:
      "An online social deduction game. Players join a room with a four-letter code, take timed turns giving one-word clues, then vote on who the imposter is. A Node WebSocket server owns the room state and keeps every client in step through each phase.",
    highlights: [
      "Four-letter room codes with a server-authoritative lobby",
      "Timed clue turns, anonymous voting, tally and a final imposter guess",
      "Twenty-odd screen components driven by one socket connection",
    ],
    tech: ["React", "Node.js", "WebSockets", "Vite"],
    github: "https://github.com/Kunyuan1/Imposter",
    live: "https://imposter-inky.vercel.app/",
    images: [],
  },
  {
    num: "02",
    slug: "medi-cal",
    title: "Medi-Cal Scheduling",
    kind: "Full-Stack Web App · 2024",
    summary: "Appointment booking built around the patient's calendar, not a form queue.",
    description:
      "A Django scheduling app for surgeon–patient workflows. Patients sign in, see what's coming on a personal calendar, book new or follow-up appointments, and cancel without phoning anyone.",
    highlights: [
      "Django models and migrations for patients, surgeries and follow-ups",
      "Authenticated accounts with per-patient appointment history",
      "Calendar views with booking, rescheduling and validation",
    ],
    tech: ["Python", "Django", "SQLite", "CSS"],
    github: "https://github.com/Kunyuan1/Medi-Cal_Scheduling",
    images: [
      { src: mediFront, alt: "Medi-Cal Scheduling landing page" },
      { src: mediLogin, alt: "Medi-Cal Scheduling login screen" },
      { src: mediServices, alt: "Medi-Cal Scheduling services listing" },
      { src: mediLifestyle, alt: "Medi-Cal Scheduling lifestyle section" },
      { src: mediSchedule, alt: "Medi-Cal Scheduling personal calendar" },
      { src: mediBooking, alt: "Medi-Cal Scheduling booking form" },
    ],
  },
  {
    num: "03",
    slug: "erics-mansion",
    title: "Eric's Mansion",
    kind: "Game Development · 2024",
    summary: "A mansion worth getting lost in.",
    description:
      "A choose-your-own-adventure exploration game in Pygame. Navigate room by room, collect clues and items, and find a way out — with hand-drawn sprites and a different path through the house each time.",
    highlights: [
      "Room-by-room state tracking that gates what you can do next",
      "Inventory and clue collection driving multiple routes out",
      "Sprite animation and scene composition built directly on Pygame",
    ],
    tech: ["Python", "Pygame", "EasyGUI"],
    github: "https://github.com/Kunyuan1/Erics_Mansion",
    images: [
      { src: gameFront, alt: "Eric's Mansion title screen" },
      { src: gameStart, alt: "Eric's Mansion opening scene" },
      { src: gameBasement, alt: "Eric's Mansion basement room" },
      { src: gameLiving, alt: "Eric's Mansion living room" },
    ],
  },
  {
    num: "04",
    slug: "worst-birthday",
    title: "Worst Birthday UI",
    kind: "UI Experiment · 2024",
    summary: "Deliberately terrible interfaces, seriously built.",
    description:
      "An experiment in hostile design. Entering your birthday means beating a hand of blackjack, then wrestling a calculator whose only operations are ×3, +7, ÷5 and square root. Making bad UI well turns out to teach a lot about what good UI is quietly doing.",
    highlights: [
      "A date field gated behind a series of adversarial minigames",
      "Working blackjack hand logic, and a calculator with no useful operations",
      "Built as a study in interaction cost — every choice is the wrong one",
    ],
    tech: ["Python", "Pygame"],
    github: "https://github.com/Kunyuan1/Worst-Birthday-UI",
    images: [
      { src: birthdayInput, alt: "Worst Birthday UI date entry screen" },
      { src: birthdayBlackjack, alt: "Worst Birthday UI blackjack minigame" },
      { src: birthdayCalculator, alt: "Worst Birthday UI calculator challenge" },
    ],
  },
];
