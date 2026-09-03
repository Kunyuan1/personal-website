import { useReveal } from '../hooks/useReveal'
import Divider from '../components/Divider'

const PROJECTS = [
  {
    num: '01',
    name: 'Imposter',
    type: 'Real-Time Multiplayer · 2026',
    desc: 'An online social deduction party game. Players join a room with a four-letter code, take timed turns giving clues, then vote on who the imposter is — with anonymous voting, a tally screen, and a final guess mechanic. A Node WebSocket server keeps every player in sync.',
    tags: ['React', 'Node.js', 'WebSockets', 'Vite'],
    href: 'https://github.com/Kunyuan1/Imposter',
    live: 'https://imposter-inky.vercel.app/',
  },
  {
    num: '02',
    name: "Eric's Mansion",
    type: 'Game Development · 2024',
    desc: 'A choose-your-own-adventure exploration game — navigate rooms, collect clues and items, and escape the mansion.',
    tags: ['Python', 'Pygame'],
    href: 'https://github.com/Kunyuan1/Erics_Mansion',
  },
  {
    num: '03',
    name: 'Medi-Cal Scheduling',
    type: 'Full Stack Web App · 2024',
    desc: 'A scheduling web app for surgeon-patient workflows — calendar views, appointment booking, follow-up management, and validation.',
    tags: ['Python', 'Django', 'CSS'],
    href: 'https://github.com/Kunyuan1/Medi-Cal_Scheduling',
  },
  {
    num: '04',
    name: 'Worst Birthday UI',
    type: 'UI Experiment · 2024',
    desc: 'A deliberately hostile interface. Entering your birthday means beating a hand of blackjack, then wrestling a calculator whose only operations are ×3, +7, ÷5 and square root. Built as a study in interaction cost — by making every choice the wrong one.',
    tags: ['Python', 'Pygame'],
    href: 'https://github.com/Kunyuan1/Worst-Birthday-UI',
  },
]

export default function ProjectsPage() {
  useReveal('projects')

  return (
    <div className="hex-page">
      <div className="hex-projects-hero">
        <div className="hex-grid-bg" />
        <div className="corner-ornament tl" />
        <div className="corner-ornament tr" />
        <p className="hex-eyebrow reveal">// Projects · Portfolio //</p>
        <Divider />
        <h2 className="hex-section-title reveal">The Archive</h2>
        <Divider />
        <p className="hex-section-sub reveal">A list that only seeks to lengthen.</p>
      </div>

      <div className="hex-projects-list">
        {PROJECTS.map((proj, i) => (
          <a
            key={proj.num}
            href={proj.href}
            target="_blank"
            rel="noreferrer"
            className="hex-proj reveal"
            style={{ transitionDelay: `${i * 0.07}s`, textDecoration: 'none' }}
            data-hover
          >
            <span className="hex-proj-num">{proj.num}</span>
            <div>
              <div className="hex-proj-name">{proj.name}</div>
              <div className="hex-proj-type">{proj.type}</div>
              <div className="hex-proj-desc">{proj.desc}</div>
              {proj.live && (
                <a
                  href={proj.live}
                  target="_blank"
                  rel="noreferrer"
                  className="hex-proj-live"
                  onClick={e => e.stopPropagation()}
                >
                  ◆ Live Site
                </a>
              )}
            </div>
            <div className="hex-tags">
              {proj.tags.map(tag => (
                <span key={tag} className="hex-tag">{tag}</span>
              ))}
            </div>
            <span className="hex-arrow">→</span>
          </a>
        ))}
      </div>
    </div>
  )
}
