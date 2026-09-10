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
  "爱案暗八壁不存答代档滴队沌蛾飞工关寒好黑恒胡回毁混纪技架简舰奖降教经具框焜历连联烈林领流码面灭明目能片日三散森生首水所体脱维文系箱项校星续学严言焰要业页已英邮于宇语育元在照者智宙珠专子字";
