import { useState, useRef } from 'react'

const SIZES = [90, 96, 102, 110, 118, 126, 136, 148, 162, 178]

const getExpression = (feeds, animState) => {
  if (animState === 'sneeze1')  return 'scrunch'
  if (animState === 'sneeze2')  return 'blast'
  if (animState === 'sneeze3')  return 'relief'
  if (animState === 'eating')   return 'eating'
  if (animState === 'tickle')   return 'tickle'
  if (feeds >= 9)  return 'desperate'
  if (feeds >= 6)  return 'stuffed'
  if (feeds >= 3)  return 'excited'
  return 'happy'
}

function PoroFace({ feeds, animState }) {
  const expr = getExpression(feeds, animState)
  const blush = Math.min(0.2 + feeds * 0.07, 0.85)
  const tongueY  = feeds >= 6 ? 60 : 56
  const tongueRx = feeds >= 6 ? 13 : feeds >= 3 ? 11 : 9
  const tongueRy = feeds >= 6 ? 11 : feeds >= 3 ? 9  : 7

  return (
    <svg viewBox="0 0 100 90" xmlns="http://www.w3.org/2000/svg" className="poro-svg"
      style={{ width: SIZES[Math.min(feeds,9)], height: SIZES[Math.min(feeds,9)] * 0.88 }}>
      <ellipse cx="50" cy="58" rx={36+feeds*0.8}  ry={28+feeds*0.6} fill="#e8e8f0"/>
      <ellipse cx="50" cy="74" rx={32+feeds}       ry={10+feeds*0.4} fill="#d8d8e8"/>
      <ellipse cx={26-feeds*0.3} cy="72" rx="13" ry="8" fill="#d8d8e8"/>
      <ellipse cx={74+feeds*0.3} cy="72" rx="13" ry="8" fill="#d8d8e8"/>
      <ellipse cx="30" cy="28" rx="9" ry="12" fill="#5a3a1a" transform="rotate(-15 30 28)"/>
      <ellipse cx="30" cy="22" rx="6" ry="8"  fill="#7a5a3a" transform="rotate(-15 30 22)"/>
      <ellipse cx="70" cy="28" rx="9" ry="12" fill="#5a3a1a" transform="rotate(15 70 28)"/>
      <ellipse cx="70" cy="22" rx="6" ry="8"  fill="#7a5a3a" transform="rotate(15 70 22)"/>
      <ellipse cx="50" cy="42" rx={28+feeds*0.4} ry={24+feeds*0.3} fill="#f0f0f8"/>

      {expr === 'happy' && <>
        <path d="M37 40 Q40 37 43 40" stroke="#2a2a3a" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        <path d="M57 40 Q60 37 63 40" stroke="#2a2a3a" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      </>}
      {expr === 'eating' && <>
        <path d="M37 40 Q40 36 43 40" stroke="#2a2a3a" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        <path d="M57 40 Q60 36 63 40" stroke="#2a2a3a" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        <text x="27" y="33" fontSize="8" fill="#f0c040">✦</text>
        <text x="63" y="33" fontSize="8" fill="#f0c040">✦</text>
      </>}
      {expr === 'tickle' && <>
        {/* Squiggly laugh eyes */}
        <path d="M36 38 Q38 41 40 38 Q42 35 44 38" stroke="#2a2a3a" strokeWidth="2" fill="none" strokeLinecap="round"/>
        <path d="M56 38 Q58 41 60 38 Q62 35 64 38" stroke="#2a2a3a" strokeWidth="2" fill="none" strokeLinecap="round"/>
        {/* Rosy cheeks extra */}
        <ellipse cx="34" cy="46" rx="8" ry="6" fill="#ff8080" opacity="0.5"/>
        <ellipse cx="66" cy="46" rx="8" ry="6" fill="#ff8080" opacity="0.5"/>
        {/* Tears of laughter */}
        <ellipse cx="36" cy="43" rx="1.5" ry="2.5" fill="#80c8ff" opacity="0.9"/>
        <ellipse cx="64" cy="43" rx="1.5" ry="2.5" fill="#80c8ff" opacity="0.9"/>
      </>}
      {expr === 'excited' && <>
        <circle cx="40" cy="40" r="4" fill="#2a2a3a"/>
        <circle cx="60" cy="40" r="4" fill="#2a2a3a"/>
        <circle cx="42" cy="38" r="1.5" fill="white"/>
        <circle cx="62" cy="38" r="1.5" fill="white"/>
      </>}
      {expr === 'stuffed' && <>
        <path d="M36 39 Q40 37 44 39" stroke="#2a2a3a" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        <path d="M36 41 Q40 40 44 41" stroke="#2a2a3a" strokeWidth="1"   fill="none" strokeLinecap="round"/>
        <path d="M56 39 Q60 37 64 39" stroke="#2a2a3a" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        <path d="M56 41 Q60 40 64 41" stroke="#2a2a3a" strokeWidth="1"   fill="none" strokeLinecap="round"/>
        <ellipse cx="68" cy="35" rx="2" ry="3" fill="#80c8e8" opacity="0.8"/>
      </>}
      {expr === 'desperate' && <>
        <circle cx="40" cy="40" r="5" fill="#2a2a3a"/>
        <circle cx="60" cy="40" r="5" fill="#2a2a3a"/>
        <circle cx="42" cy="38" r="2" fill="white"/>
        <circle cx="62" cy="38" r="2" fill="white"/>
        <ellipse cx="37" cy="46" rx="2" ry="3" fill="#80c8ff" opacity="0.9"/>
        <ellipse cx="63" cy="46" rx="2" ry="3" fill="#80c8ff" opacity="0.9"/>
        <path d="M42 53 Q46 56 50 53 Q54 50 58 53" stroke="#2a2a3a" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      </>}
      {expr === 'scrunch' && <>
        <path d="M35 40 L43 37" stroke="#2a2a3a" strokeWidth="3" strokeLinecap="round"/>
        <path d="M35 37 L43 40" stroke="#2a2a3a" strokeWidth="3" strokeLinecap="round"/>
        <path d="M57 40 L65 37" stroke="#2a2a3a" strokeWidth="3" strokeLinecap="round"/>
        <path d="M57 37 L65 40" stroke="#2a2a3a" strokeWidth="3" strokeLinecap="round"/>
        <ellipse cx="47" cy="50" rx="3" ry="2" fill="#ffb0b0"/>
        <ellipse cx="53" cy="50" rx="3" ry="2" fill="#ffb0b0"/>
      </>}
      {expr === 'blast' && <>
        <circle cx="40" cy="39" r="6" fill="white" stroke="#2a2a3a" strokeWidth="1.5"/>
        <circle cx="60" cy="39" r="6" fill="white" stroke="#2a2a3a" strokeWidth="1.5"/>
        <circle cx="40" cy="39" r="3" fill="#2a2a3a"/>
        <circle cx="60" cy="39" r="3" fill="#2a2a3a"/>
        <line x1="30" y1="55" x2="10" y2="50" stroke="#c8f0ff" strokeWidth="2"   strokeLinecap="round"/>
        <line x1="28" y1="60" x2="5"  y2="60" stroke="#c8f0ff" strokeWidth="2.5" strokeLinecap="round"/>
        <line x1="30" y1="65" x2="8"  y2="72" stroke="#c8f0ff" strokeWidth="2"   strokeLinecap="round"/>
      </>}
      {expr === 'relief' && <>
        <path d="M36 41 Q40 38 44 41" stroke="#2a2a3a" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        <path d="M56 41 Q60 38 64 41" stroke="#2a2a3a" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
        <ellipse cx="32" cy="38" rx="2" ry="3" fill="#80c8e8" opacity="0.8"/>
        <ellipse cx="68" cy="38" rx="2" ry="3" fill="#80c8e8" opacity="0.8"/>
      </>}

      {expr !== 'scrunch' && expr !== 'desperate' && (
        <>
          <ellipse cx="50" cy={tongueY} rx={tongueRx} ry={tongueRy} fill="#e87090"/>
          <line x1="50" y1={tongueY-tongueRy+2} x2="50" y2={tongueY+tongueRy-2} stroke="#c05070" strokeWidth="1.5"/>
        </>
      )}
      <ellipse cx="34" cy="48" rx="7" ry="5" fill="#ffb0c0" opacity={blush}/>
      <ellipse cx="66" cy="48" rx="7" ry="5" fill="#ffb0c0" opacity={blush}/>
      <ellipse cx="20" cy="78" rx="9" ry="6" fill="#5a3a1a"/>
      <ellipse cx="80" cy="78" rx="9" ry="6" fill="#5a3a1a"/>
    </svg>
  )
}

/* ── Elder Poro — big crowned bearded SVG ── */
function ElderPoro() {
  return (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="elder-poro-svg">
      {/* Glow */}
      <defs>
        <radialGradient id="elderGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#c89b3c" stopOpacity="0.3"/>
          <stop offset="100%" stopColor="#c89b3c" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="100" rx="95" ry="95" fill="url(#elderGlow)"/>

      {/* Body */}
      <ellipse cx="100" cy="130" rx="75" ry="58" fill="#e8e8f0"/>
      {/* Ruff */}
      <ellipse cx="100" cy="158" rx="70" ry="22" fill="#d0d0e0"/>
      <ellipse cx="52"  cy="155" rx="26" ry="16" fill="#d0d0e0"/>
      <ellipse cx="148" cy="155" rx="26" ry="16" fill="#d0d0e0"/>

      {/* Horns */}
      <ellipse cx="58"  cy="55" rx="18" ry="26" fill="#5a3a1a" transform="rotate(-18 58 55)"/>
      <ellipse cx="58"  cy="42" rx="12" ry="17" fill="#7a5a3a" transform="rotate(-18 58 42)"/>
      <ellipse cx="142" cy="55" rx="18" ry="26" fill="#5a3a1a" transform="rotate(18 142 55)"/>
      <ellipse cx="142" cy="42" rx="12" ry="17" fill="#7a5a3a" transform="rotate(18 142 42)"/>

      {/* Crown */}
      <polygon points="70,52 80,28 90,44 100,20 110,44 120,28 130,52" fill="#c89b3c" stroke="#a07820" strokeWidth="2"/>
      {/* Crown gems */}
      <circle cx="100" cy="26" r="5" fill="#e84060"/>
      <circle cx="80"  cy="34" r="3.5" fill="#00d4e8"/>
      <circle cx="120" cy="34" r="3.5" fill="#00d4e8"/>
      <rect x="68" y="50" width="64" height="10" rx="3" fill="#c89b3c" stroke="#a07820" strokeWidth="1.5"/>

      {/* Head */}
      <ellipse cx="100" cy="100" rx="62" ry="55" fill="#f0f0f8"/>

      {/* Wise old eyes — half-closed */}
      <path d="M72 95 Q80 90 88 95" stroke="#2a2a3a" strokeWidth="4" fill="none" strokeLinecap="round"/>
      <path d="M72 98 Q80 96 88 98" stroke="#2a2a3a" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <path d="M112 95 Q120 90 128 95" stroke="#2a2a3a" strokeWidth="4" fill="none" strokeLinecap="round"/>
      <path d="M112 98 Q120 96 128 98" stroke="#2a2a3a" strokeWidth="2" fill="none" strokeLinecap="round"/>

      {/* Wise eyebrows */}
      <path d="M70 86 Q80 80 88 84" stroke="#8a6a3a" strokeWidth="3" fill="none" strokeLinecap="round"/>
      <path d="M112 84 Q120 80 130 86" stroke="#8a6a3a" strokeWidth="3" fill="none" strokeLinecap="round"/>

      {/* Magnificent beard */}
      <ellipse cx="100" cy="132" rx="38" ry="28" fill="#e8e8f0"/>
      <path d="M65 118 Q72 148 80 162 Q90 175 100 172 Q110 175 120 162 Q128 148 135 118" fill="#f0f0f8" stroke="#d0d0e0" strokeWidth="1"/>
      {/* Beard strands */}
      <path d="M80 125 Q78 148 82 165" stroke="#c8c8d8" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <path d="M90 128 Q88 152 92 170" stroke="#c8c8d8" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <path d="M100 130 Q100 155 100 172" stroke="#c8c8d8" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <path d="M110 128 Q112 152 108 170" stroke="#c8c8d8" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <path d="M120 125 Q122 148 118 165" stroke="#c8c8d8" strokeWidth="1.5" fill="none" strokeLinecap="round"/>

      {/* Tongue — regal and small */}
      <ellipse cx="100" cy="122" rx="14" ry="10" fill="#e87090"/>
      <line x1="100" y1="113" x2="100" y2="131" stroke="#c05070" strokeWidth="2"/>

      {/* Blush */}
      <ellipse cx="72"  cy="106" rx="12" ry="8" fill="#ffb0c0" opacity="0.5"/>
      <ellipse cx="128" cy="106" rx="12" ry="8" fill="#ffb0c0" opacity="0.5"/>

      {/* Paws */}
      <ellipse cx="38"  cy="165" rx="18" ry="12" fill="#5a3a1a"/>
      <ellipse cx="162" cy="165" rx="18" ry="12" fill="#5a3a1a"/>

      {/* Gold star sparkles around */}
      <text x="20"  y="60"  fontSize="18" fill="#c89b3c" opacity="0.9">✦</text>
      <text x="162" y="60"  fontSize="18" fill="#c89b3c" opacity="0.9">✦</text>
      <text x="10"  y="120" fontSize="12" fill="#c89b3c" opacity="0.7">✦</text>
      <text x="175" y="120" fontSize="12" fill="#c89b3c" opacity="0.7">✦</text>
    </svg>
  )
}

let cookieIdCounter = 0
let giggleIdCounter = 0

export default function Poro({ page }) {
  const [feeds, setFeeds] = useState(0)
  const [animState, setAnimState] = useState('idle')
  const [hearts, setHearts] = useState([])
  const [stars, setStars] = useState([])
  const [fallingCookies, setFallingCookies] = useState([])
  const [giggleTexts, setGiggleTexts] = useState([])
  const [tickleCount, setTickleCount] = useState(0)
  const [showElder, setShowElder] = useState(false)
  const [elderState, setElderState] = useState('idle') // idle | dropping | landed | leaving
  const heartId   = useRef(0)
  const starId    = useRef(0)
  const sneezing  = useRef(false)
  const tickling  = useRef(false)
  const tickleRef = useRef(0)

  /* ── Sneeze ── */
  const triggerSneeze = () => {
    sneezing.current = true
    setAnimState('sneeze1')
    setTimeout(() => {
      setAnimState('sneeze2')
      const newStars = Array.from({ length: 10 }, () => starId.current++)
      setStars(s => [...s, ...newStars])
      setTimeout(() => setStars(s => s.filter(x => !newStars.includes(x))), 1400)
    }, 900)
    setTimeout(() => setAnimState('sneeze3'), 1800)
    setTimeout(() => { setAnimState('idle'); setFeeds(0); sneezing.current = false }, 3200)
  }

  /* ── Elder Poro ── */
  const triggerElder = () => {
    setShowElder(true)
    setElderState('dropping')
    setTimeout(() => setElderState('landed'),  800)
    setTimeout(() => setElderState('leaving'), 3500)
    setTimeout(() => { setShowElder(false); setElderState('idle') }, 4800)
  }

  /* ── Feed ── */
  const feedPoro = () => {
    if (sneezing.current) return
    tickleRef.current = 0
    setTickleCount(0)

    const id = cookieIdCounter++
    const offsetX = (Math.random() - 0.5) * 30
    setFallingCookies(c => [...c, { id, offsetX }])

    setTimeout(() => {
      setFallingCookies(c => c.filter(x => x.id !== id))
      setAnimState('eating')
      setTimeout(() => setAnimState('idle'), 500)
      const hid = heartId.current++
      setHearts(h => [...h, hid])
      setTimeout(() => setHearts(h => h.filter(x => x !== hid)), 1200)
      const next = feeds + 1
      setFeeds(next)
      if (next >= 10) setTimeout(triggerSneeze, 300)
    }, 580)
  }

  /* ── Tickle ── */
  const ticklePoro = () => {
    if (sneezing.current || tickling.current) return
    tickling.current = true

    setAnimState('tickle')
    setTimeout(() => { setAnimState('idle'); tickling.current = false }, 700)

    // Giggle text
    const GIGGLES = ['hehe!', 'hehehe!', 'stop!', 'haha!', '(*≧▽≦)', 'teehee!']
    const gid = giggleIdCounter++
    const text = GIGGLES[Math.floor(Math.random() * GIGGLES.length)]
    const offsetX = (Math.random() - 0.5) * 60
    setGiggleTexts(g => [...g, { id: gid, text, offsetX }])
    setTimeout(() => setGiggleTexts(g => g.filter(x => x.id !== gid)), 1000)

    // Track consecutive tickles
    const next = tickleRef.current + 1
    tickleRef.current = next
    setTickleCount(next)

    if (next >= 7) {
      tickleRef.current = 0
      setTickleCount(0)
      setTimeout(triggerElder, 400)
    }
  }

  const isSneeze = animState.startsWith('sneeze')

  return (
    <>
      {/* ── Elder Poro overlay ── */}
      {showElder && (
        <div className={`elder-overlay ${elderState}`}>
          <div className={`elder-poro-wrap ${elderState}`}>
            <ElderPoro />
            {elderState === 'landed' && (
              <div className="elder-title">THE PORO KING</div>
            )}
          </div>
          {elderState === 'landed' && (
            <>
              <div className="elder-shockwave"/>
              <div className="elder-shockwave elder-shockwave-2"/>
              <div className="elder-ground-crack"/>
            </>
          )}
        </div>
      )}

      {/* ── Regular Poro ── */}
      <div className="poro-wrap">

        {/* Cookie button */}
        {!isSneeze && (
          <button className="poro-cookie" onClick={feedPoro} title="Feed the Poro!">
            <svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
              <circle cx="20" cy="20" r="17" fill="#c8841a"/>
              <circle cx="20" cy="20" r="14" fill="#d4922a"/>
              <path d="M14 20 Q17 14 20 20 Q23 26 26 20" stroke="#a06010" strokeWidth="2" fill="none" strokeLinecap="round"/>
              <ellipse cx="15" cy="15" rx="2.5" ry="2" fill="#6b3a10" transform="rotate(-20 15 15)"/>
              <ellipse cx="26" cy="17" rx="2"   ry="1.5" fill="#6b3a10" transform="rotate(15 26 17)"/>
              <ellipse cx="18" cy="26" rx="2"   ry="1.5" fill="#6b3a10" transform="rotate(-10 18 26)"/>
            </svg>
            {feeds > 0 && <span className="poro-feed-count">{feeds}/10</span>}
          </button>
        )}

        {/* Falling cookies */}
        {fallingCookies.map(({ id, offsetX }) => (
          <div key={id} className="poro-falling-cookie" style={{ '--offset-x': offsetX + 'px' }}>
            <svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" width="28" height="28">
              <circle cx="20" cy="20" r="17" fill="#c8841a"/>
              <circle cx="20" cy="20" r="14" fill="#d4922a"/>
              <path d="M14 20 Q17 14 20 20 Q23 26 26 20" stroke="#a06010" strokeWidth="2" fill="none" strokeLinecap="round"/>
              <ellipse cx="15" cy="15" rx="2.5" ry="2" fill="#6b3a10" transform="rotate(-20 15 15)"/>
              <ellipse cx="26" cy="17" rx="2"   ry="1.5" fill="#6b3a10" transform="rotate(15 26 17)"/>
              <ellipse cx="18" cy="26" rx="2"   ry="1.5" fill="#6b3a10" transform="rotate(-10 18 26)"/>
            </svg>
          </div>
        ))}

        {/* Hearts */}
        {hearts.map(id => (
          <div key={id} className="poro-heart" style={{ right: 10 + Math.random() * 30 + 'px' }}>♥</div>
        ))}

        {/* Sneeze stars */}
        {stars.map((id, i) => (
          <div key={id} className="poro-star" style={{
            '--angle': `${(i/10)*360}deg`,
            '--dist': `${50 + Math.random()*60}px`,
            bottom: 60 + Math.random()*40 + 'px',
            right:  20 + Math.random()*60 + 'px',
          }}>✦</div>
        ))}

        {/* Giggle texts */}
        {giggleTexts.map(({ id, text, offsetX }) => (
          <div key={id} className="poro-giggle" style={{ '--goffset': offsetX + 'px' }}>{text}</div>
        ))}

        {/* Tickle streak hint */}
        {tickleCount >= 3 && tickleCount < 7 && (
          <div className="poro-tickle-streak">
            {tickleCount >= 6 ? '👑 one more...' : `tickle x${tickleCount}`}
          </div>
        )}

        {/* Sneeze text */}
        {animState === 'sneeze1' && <div className="poro-sneeze-buildup">a... a...</div>}
        {animState === 'sneeze2' && <div className="poro-sneeze">A—ACHOO!</div>}
        {animState === 'sneeze3' && <div className="poro-sneeze-relief">...phew</div>}

        {/* Poro body — clickable for tickle */}
        <div
          className={`poro-body anim-${animState}`}
          onClick={ticklePoro}
          title="Tickle the Poro!"
          style={{ cursor: 'pointer', pointerEvents: 'all' }}
        >
          <PoroFace feeds={feeds} animState={animState} />
        </div>
      </div>
    </>
  )
}
