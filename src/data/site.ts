export const site = {
  name: "Kunyuan Hu",
  nameCjk: "胡坤源",
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
  "首页项目关于简历联系三体黑暗森林智子混沌纪元恒文明不要回答水滴面壁者降维档案技能宇宙生存胡坤源";
