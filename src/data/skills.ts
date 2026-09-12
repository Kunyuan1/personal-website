export type SkillGroup = {
  label: string;
  cjk: string;
  items: string[];
};

/** Taken from what the projects actually use, not aspirational. */
export const skillGroups: SkillGroup[] = [
  {
    label: "Languages",
    cjk: "语言",
    items: ["Python", "Java", "JavaScript", "TypeScript", "C", "SQL", "HTML", "CSS"],
  },
  {
    label: "Frameworks",
    cjk: "框架",
    items: ["React", "Next.js", "FastAPI", "Django", "Node.js", "Pygame", "Tailwind CSS"],
  },
  {
    label: "Tools",
    cjk: "工具",
    items: [
      "Git",
      "Docker",
      "Celery",
      "OpenCV",
      "PostgreSQL",
      "WebSockets",
      "Vite",
      "SQLite",
      "Vercel",
      "Linux",
    ],
  },
];
