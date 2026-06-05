import { useReveal } from '../hooks/useReveal'
import Divider from '../components/Divider'
import HextechChest from '../components/HextechChest'

export default function AboutPage() {
  useReveal('about')

  return (
    <div className="hex-page">
      <div className="hex-about-hero">
        <div className="hex-grid-bg" />
        <div className="corner-ornament tl" />
        <div className="corner-ornament tr" />
        <p className="hex-eyebrow reveal">◆ About Me ◆</p>
        <Divider />
        <h2 className="hex-section-title reveal">Who I Am</h2>
        <Divider />
        <p className="hex-section-sub reveal">Developer. Student. Creator.</p>
      </div>

      <div className="hex-about-content">
        <div className="hex-bio reveal">
          <p>
            Hi, I'm <strong>Kunyuan</strong>. I'm studying computer science and statistics
            at the <strong>University of Toronto Mississauga</strong>. I have a passion for
            <strong> game development</strong> and <strong>artificial intelligence</strong>.
          </p>
          <p>
            Outside of coding, I love working out, playing video games, and singing.
            I enjoy building projects that combine creativity, problem solving, and
            clean software design.
          </p>
        </div>

        <p className="hex-sub-label reveal" style={{ marginTop: '3.5rem', textAlign: 'center' }}>
          ◆ Open the chest to discover my skills
        </p>
        <HextechChest />
      </div>
    </div>
  )
}
