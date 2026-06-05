import { useReveal } from '../hooks/useReveal'
import Divider from '../components/Divider'

const LINKS = [
  {
    label: 'Email',
    handle: 'kunyuanhu01@gmail.com',
    href: 'mailto:kunyuanhu01@gmail.com',
    icon: '✉',
  },
  {
    label: 'LinkedIn',
    handle: 'kunyuan-hu',
    href: 'https://www.linkedin.com/in/kunyuan-hu-2a088430a/',
    icon: 'in',
  },
  {
    label: 'GitHub',
    handle: 'Kunyuan1',
    href: 'https://github.com/Kunyuan1',
    icon: '<>',
  },
  {
    label: 'Instagram',
    handle: '@kunyuan_hu',
    href: 'https://www.instagram.com/kunyuan_hu/',
    icon: '◎',
  },
]

export default function ContactPage() {
  useReveal('contact')

  return (
    <div className="hex-page">
      <div className="hex-contact-hero">
        <div className="hex-grid-bg" />
        <div className="corner-ornament tl" />
        <div className="corner-ornament tr" />
        <div className="corner-ornament bl" />
        <div className="corner-ornament br" />

        <p className="hex-eyebrow reveal">◆ Get in Touch ◆</p>
        <Divider />
        <h2 className="hex-section-title reveal">Let's Connect</h2>
        <Divider />
        <p className="hex-section-sub reveal">
          Open to collaborations, commissions, and good conversations.
        </p>
      </div>

      <div className="hex-contact-links">
        {LINKS.map((link, i) => (
          <a
            key={link.label}
            href={link.href}
            target={link.href.startsWith('mailto') ? undefined : '_blank'}
            rel="noreferrer"
            className="hex-contact-card reveal"
            style={{ transitionDelay: `${i * 0.08}s` }}
          >
            <div className="hex-contact-icon">{link.icon}</div>
            <div className="hex-contact-info">
              <div className="hex-contact-label">{link.label}</div>
              <div className="hex-contact-handle">{link.handle}</div>
            </div>
            <span className="hex-contact-arrow">→</span>
          </a>
        ))}
      </div>
    </div>
  )
}
