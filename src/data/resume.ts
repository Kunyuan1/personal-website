/**
 * Résumé content, kept in step with public/resume.pdf.
 *
 * The PDF is the one-page version and this is the same material with room to
 * breathe; if one changes, change the other. Projects are deliberately absent —
 * the PDF lists four, the site has its own archive in src/data/projects.ts, and
 * keeping a second copy of them here would just be a third thing to forget.
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
    period: "Expected May 2029",
    location: "Mississauga, ON",
    points: [
      "Double major. Coursework in software design, data structures & analysis, probability and statistics, linear algebra and calculus.",
    ],
  },
];

export const experience: ResumeEntry[] = [
  {
    title: "Research Assistant",
    organization: "Dr. Antonio Vivone, University of Toronto",
    period: "Oct 2026 — Present",
    location: "Toronto, ON",
    points: [
      "Audited the dataset and supplementary materials of a multi-classroom education study ahead of manuscript submission, delivering a report of 15 findings ranked by severity.",
      "Reproduced the study's mixed-effects model, effect sizes and MANCOVA from raw data, reconstructing the undocumented classroom groupings needed to verify the reported results.",
      "Identified two interaction tests mislabelled as omnibus tests, and recomputed the correct joint Wald tests.",
      "Continuing with the project as a summer research assistant in 2027.",
    ],
  },
  {
    title: "Server, Part-Time",
    organization: "The Bradley Gracious Retirement Living",
    period: "Dec 2022 — Mar 2024",
    location: "Mississauga, ON",
    points: [
      "Served residents daily in an assisted living community, balancing speed of service against individual dietary needs and accessibility requirements.",
      "Held the role for 15 months alongside full-time studies, coordinating with kitchen and care staff through peak service.",
    ],
  },
];
