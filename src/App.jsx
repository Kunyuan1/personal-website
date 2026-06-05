import { useState } from 'react'
import Nav from './components/Nav'
import Poro from './components/Poro'
import MainPage from './pages/MainPage'
import ProjectsPage from './pages/ProjectsPage'
import AboutPage from './pages/AboutPage'
import ContactPage from './pages/ContactPage'
import './styles/global.css'
import './styles/hextech.css'

export default function App() {
  const [page, setPage] = useState('main')

  const navigateTo = (newPage) => {
    setPage(newPage)
    window.scrollTo(0, 0)
  }

  return (
    <>
      <Nav page={page} setPage={navigateTo} />
      <Poro page={page} />

      {page === 'main'     && <MainPage     setPage={navigateTo} />}
      {page === 'projects' && <ProjectsPage />}
      {page === 'about'    && <AboutPage />}
      {page === 'contact'  && <ContactPage />}
    </>
  )
}
