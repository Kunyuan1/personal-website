import { useState } from 'react'

const SKILLS = [
  { name: 'Python',      color: '#3b82f6' },
  { name: 'JavaScript',  color: '#f59e0b' },
  { name: 'React',       color: '#00d4e8' },
  { name: 'Django',      color: '#22c55e' },
  { name: 'CSS',         color: '#a855f7' },
  { name: 'HTML',        color: '#f97316' },
  { name: 'C',           color: '#6366f1' },
]

export default function HextechChest() {
  const [state, setState] = useState('idle') // idle | opening | open
  const [visibleSkills, setVisibleSkills] = useState([])

  const openChest = () => {
    if (state !== 'idle') return
    setState('opening')
    setVisibleSkills([])

    // Reveal skills one by one after burst
    SKILLS.forEach((_, i) => {
      setTimeout(() => {
        setVisibleSkills(prev => [...prev, i])
        if (i === SKILLS.length - 1) setState('open')
      }, 700 + i * 120)
    })
  }

  const reset = () => {
    setState('idle')
    setVisibleSkills([])
  }

  return (
    <div className="hex-chest-wrap">
      {/* Chest */}
      <div
        className={`hex-chest ${state}`}
        onClick={openChest}
        data-hover
        title={state === 'idle' ? 'Open chest' : ''}
      >
        {/* Chest SVG */}
        <svg viewBox="0 0 120 100" className="hex-chest-svg" xmlns="http://www.w3.org/2000/svg">
          {/* Glow filter */}
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2.5" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="glow-strong">
              <feGaussianBlur stdDeviation="4" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          {/* Chest body */}
          <rect x="10" y="48" width="100" height="46" rx="4"
            fill="#0a1828" stroke="#1a3a5c" strokeWidth="1.5"/>

          {/* Chest lid — rotates open */}
          <g className="hex-chest-lid">
            <rect x="10" y="16" width="100" height="36" rx="4"
              fill="#0d2035" stroke="#1a3a5c" strokeWidth="1.5"/>
            {/* Lid corner bolts */}
            <circle cx="18" cy="24" r="2.5" fill="#c89b3c" opacity="0.7"/>
            <circle cx="102" cy="24" r="2.5" fill="#c89b3c" opacity="0.7"/>
            <circle cx="18" cy="44" r="2.5" fill="#c89b3c" opacity="0.7"/>
            <circle cx="102" cy="44" r="2.5" fill="#c89b3c" opacity="0.7"/>
            {/* Lid rune lines */}
            <line x1="28" y1="34" x2="52" y2="34" stroke="#00d4e8" strokeWidth="0.8" opacity="0.4"/>
            <line x1="68" y1="34" x2="92" y2="34" stroke="#00d4e8" strokeWidth="0.8" opacity="0.4"/>
          </g>

          {/* Body details */}
          <rect x="10" y="48" width="100" height="6" fill="#0f2a42" rx="1"/>
          {/* Corner bolts body */}
          <circle cx="18" cy="70" r="2.5" fill="#c89b3c" opacity="0.7"/>
          <circle cx="102" cy="70" r="2.5" fill="#c89b3c" opacity="0.7"/>
          {/* Center lock */}
          <rect x="50" y="58" width="20" height="14" rx="3"
            fill="#0a1828" stroke="#c89b3c" strokeWidth="1" className="hex-chest-lock"/>
          <circle cx="60" cy="65" r="4" fill="none" stroke="#c89b3c" strokeWidth="1"/>
          <line x1="60" y1="67" x2="60" y2="70" stroke="#c89b3c" strokeWidth="1"/>
          {/* Body rune lines */}
          <line x1="28" y1="80" x2="46" y2="80" stroke="#00d4e8" strokeWidth="0.8" opacity="0.4"/>
          <line x1="74" y1="80" x2="92" y2="80" stroke="#00d4e8" strokeWidth="0.8" opacity="0.4"/>

          {/* Energy glow inside when opening */}
          <ellipse cx="60" cy="48" rx="30" ry="8"
            fill="#00d4e8" opacity="0" filter="url(#glow-strong)"
            className="hex-chest-glow"/>
        </svg>

        {/* Burst particles */}
        {state === 'opening' && (
          <div className="hex-burst" aria-hidden="true">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="hex-burst-particle"
                style={{
                  '--angle': `${i * 30}deg`,
                  '--dist': `${55 + Math.random() * 30}px`,
                  animationDelay: `${Math.random() * 0.1}s`,
                }}
              />
            ))}
          </div>
        )}

        {state === 'idle' && (
          <p className="hex-chest-prompt">Click to open</p>
        )}
      </div>

      {/* Skill gems */}
      <div className="hex-skill-gems">
        {SKILLS.map((skill, i) => (
          <div
            key={skill.name}
            className={`hex-skill-gem ${visibleSkills.includes(i) ? 'visible' : ''}`}
            style={{
              '--gem-color': skill.color,
              '--gem-glow': skill.color + '55',
              transitionDelay: `${i * 0.05}s`,
            }}
          >
            <div className="hex-skill-gem-icon">◆</div>
            <span>{skill.name}</span>
          </div>
        ))}
      </div>

      {/* Reset */}
      {state === 'open' && (
        <button className="hex-chest-reset" onClick={reset}>
          ↺ Reset
        </button>
      )}
    </div>
  )
}
