export type SkillGroup = {
  label: string;
  cjk: string;
  items: string[];
};

/**
 * What the projects actually use, plus what coursework covers — not aspiration.
 * Java is the whole of the coursework half: no Java project is in the archive,
 * but it is being taught this term and the résumé lists it. This is the gap
 * 0f7656c flagged, and Java is all that is left in it.
 *
 * Grouped the way the résumé groups them so the two read as one claim. The
 * résumé's fifth group — spoken languages — lives in the facts panel on the
 * About page instead, since it isn't part of a stack.
 */
export const skillGroups: SkillGroup[] = [
  {
    label: "Languages",
    cjk: "语言",
    items: ["Python", "TypeScript", "JavaScript", "Java", "SQL", "HTML", "CSS"],
  },
  {
    label: "Frameworks",
    cjk: "框架",
    items: ["React", "Next.js", "Node.js", "Django", "FastAPI", "Celery", "Pygame", "Tailwind CSS"],
  },
  {
    label: "ML & Data",
    cjk: "智能",
    items: ["YOLOv8-pose", "Roboflow", "OpenCV", "PostgreSQL", "SQLite"],
  },
  {
    label: "Tools",
    cjk: "工具",
    items: [
      "Git",
      "Docker",
      "FFmpeg",
      "WebSockets",
      "Redis",
      "Modal",
      "Vite",
      "REST APIs",
      "Vercel",
      "Linux",
    ],
  },
];
