import { useEffect, useRef } from 'react'
import { useReveal } from '../hooks/useReveal'
import Divider from '../components/Divider'

export default function IoniaPage({ setPage }) {
  const particlesRef = useRef(null)
  useReveal('ionia')

  useEffect(() => {
    const container = particlesRef.current
    if (!container) return
    container.innerHTML = ''
    for (let i = 0; i < 22; i++) {
      const p = document.createElement('div')
      p.className = 'hex-particle'
      const size = 3 + Math.random() * 5
      p.style.cssText = `
        left: ${Math.random() * 100}%;
        top: ${80 + Math.random() * 30}%;
        width: ${size}px; height: ${size}px;
        background: rgba(0,212,232,${0.2 + Math.random() * 0.4});
        border-radius: 1px;
        animation-duration: ${8 + Math.random() * 14}s;
        animation-delay: ${Math.random() * 10}s;
        transform: rotate(${Math.random() * 360}deg);
      `
      container.appendChild(p)
    }
  }, [])

  return (
    <div className="hex-page">
      <section className="hex-hero">
        <div className="hex-grid-bg" />
        <div ref={particlesRef} aria-hidden="true" />

        <div className="corner-ornament tl" />
        <div className="corner-ornament tr" />
        <div className="corner-ornament bl" />
        <div className="corner-ornament br" />

        <p className="hex-eyebrow reveal">Creative Designer</p>
        <Divider />
        <h1 className="hex-hero-name reveal">Kun Yuan Hu</h1>
        <Divider />
        <p className="hex-hero-title reveal">Crafting Worlds Through Design</p>
        <p className="hex-hero-sub reveal">
          Noodles are best when thin.
        </p>
        <button className="hex-hero-cta reveal" onClick={() => setPage('projects')}>
          Explore my work →
        </button>

        <div className="hex-avail">
          <div className="hex-avail-dot" />
          Available for projects
        </div>
      </section>
    </div>
  )
}
