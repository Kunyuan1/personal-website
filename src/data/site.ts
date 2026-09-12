export const site = {
  name: "Kunyuan Hu",
  nameCjk: "胡焜元",
  role: "Software Developer",
  study: "Computer Science & Statistics",
  school: "University of Toronto Mississauga",
  location: "Toronto, ON",
  tagline:
    "Computer science and statistics at UTM. I like to build software projects based off my hobbies, working with both frontend and backend — and I'm drawn to the problems where the answer isn't solvable in closed form.",
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
  "爱岸案八不存答代档冬队沌蛾飞工关寒好恒红胡回毁混纪技架简舰奖教经具框焜历连联烈领码眠灭明目能片日三首水所脱文系箱项校续学严言要业页已英邮于语育元在照智珠专子字";
