/**
 * Résumé content.
 *
 * TODO(kunyuan): everything below except the degree itself is a placeholder,
 * left in so the layout can be judged with realistic shapes in it. Replace the
 * dates, and swap the experience and award entries for real ones — or delete
 * any array entirely and its column disappears.
 */

export type ResumeEntry = {
  title: string;
  organization: string;
  period: string;
  location?: string;
  points: string[];
};

export const education: ResumeEntry[] = [
  {
    title: "HBSc, Computer Science & Statistics",
    organization: "University of Toronto Mississauga",
    period: "20XX — 20XX", // TODO: real dates
    location: "Mississauga, ON",
    points: [
      "Coursework in data structures, algorithms, software design and probability.",
      "Focus on where statistical modelling meets applied software.",
    ],
  },
];

export const experience: ResumeEntry[] = [
  {
    title: "Role Title",
    organization: "Organization",
    period: "20XX — Present",
    location: "Toronto, ON",
    points: [
      "An outcome you delivered, ideally with a number attached to it.",
      "The tools you used and what you were responsible for owning.",
    ],
  },
];

export type Award = { title: string; detail: string; year: string };

export const awards: Award[] = [
  { title: "Award or scholarship", detail: "What it was given for.", year: "20XX" },
  { title: "Hackathon or competition", detail: "Placement, and what you built.", year: "20XX" },
];
