import { useEffect, useRef, useState } from 'react'

const THEME_COLORS = {
  ionia:    { bg: '#c4547a', ring: 'rgba(196,84,122,0.5)'   },
  hextech:  { bg: '#00d4e8', ring: 'rgba(0,212,232,0.4)'    },
  freljord: { bg: '#a8d4f0', ring: 'rgba(168,212,240,0.45)' },
}

export default function Cursor({ theme }) {
  const curRef  = useRef(null)
  const ringRef = useRef(null)
  const mx = useRef(0), my = useRef(0)
  const rx = useRef(0), ry = useRef(0)
  const raf = useRef(null)
  const [hovering, setHovering] = useState(false)

  useEffect(() => {
    const onMove = (e) => {
      mx.current = e.clientX
      my.current = e.clientY
      if (curRef.current) {
        curRef.current.style.left = e.clientX + 'px'
        curRef.current.style.top  = e.clientY + 'px'
      }
    }

    const onOver = (e) => {
      setHovering(!!e.target.closest('a,button,[data-hover]'))
    }

    const animate = () => {
      rx.current += (mx.current - rx.current) * 0.1
      ry.current += (my.current - ry.current) * 0.1
      if (ringRef.current) {
        ringRef.current.style.left = rx.current + 'px'
        ringRef.current.style.top  = ry.current + 'px'
      }
      raf.current = requestAnimationFrame(animate)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseover', onOver)
    raf.current = requestAnimationFrame(animate)

    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseover', onOver)
      cancelAnimationFrame(raf.current)
    }
  }, [])

  const colors = THEME_COLORS[theme] || THEME_COLORS.ionia

  return (
    <>
      <div
        ref={curRef}
        className={`cursor ${hovering ? 'hovering' : ''}`}
        style={{ background: colors.bg }}
      />
      <div
        ref={ringRef}
        className={`cursor-ring ${hovering ? 'hovering' : ''}`}
        style={{ borderColor: colors.ring }}
      />
    </>
  )
}
