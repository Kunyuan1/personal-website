import { useEffect } from 'react'

export function useReveal(dep) {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal')
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
          }
        })
      },
      { threshold: 0.12 }
    )

    // Small delay so page paint settles after navigation
    const timeout = setTimeout(() => {
      els.forEach((el) => {
        el.classList.remove('visible')
        observer.observe(el)
      })
    }, 80)

    return () => {
      clearTimeout(timeout)
      observer.disconnect()
    }
  }, [dep])
}
