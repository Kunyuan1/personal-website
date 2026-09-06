export const site = {
  name: "Kunyuan Hu",
  nameCjk: "胡焜元",
  role: "Software Developer",
  study: "Computer Science & Statistics",
  school: "University of Toronto Mississauga",
  location: "Toronto, ON",
  tagline:
    "Computer science and statistics at UTM. I build games, real-time systems, and interfaces — and I like the problems where the answer isn't solvable in closed form.",
  email: "kunyuanhu01@gmail.com",
  github: "https://github.com/Kunyuan1",
  linkedin: "https://www.linkedin.com/in/kunyuan-hu-2a088430a/",
  instagram: "https://www.instagram.com/kunyuan_hu/",
  resumePdf: "/resume.pdf",
} as const;

/**
 * Nav labels carry a Chinese accent, but the English is always the primary
 * label — nobody should have to decode a metaphor to find the projects.
 */
export const navLinks = [
  { href: "/", label: "Home", cjk: "首页" },
  { href: "/projects", label: "Projects", cjk: "项目" },
  { href: "/about", label: "About", cjk: "关于" },
  { href: "/resume", label: "Résumé", cjk: "简历" },
  { href: "/contact", label: "Contact", cjk: "联系" },
] as const;

/** Every Chinese glyph used on the site, for font subsetting in layout.tsx. */
export const CJK_GLYPHS =
  "三不专业严于代体元八关具历回在壁奖好子字存学宇宙寒工已恒所技教散文日明星智暗林架校框案档森毁水沌流混滴灭烈焜焰照爱片珠生目码答简箱系纪经维者联育胡能脱英蛾要言语连邮降面页项领飞首黑";
