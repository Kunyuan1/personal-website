import gameFront from './assets/erics-mansion/game_front.png'
import gameStart from './assets/erics-mansion/game_start.png'
import gameBasement from './assets/erics-mansion/game_basement.png'
import gameLiving from './assets/erics-mansion/game_living.png'
import birthdayInput from './assets/worst-birthday/birthday_input.png'
import birthdayBlackjack from './assets/worst-birthday/birthday_blackjack.png'
import birthdayCalculator from './assets/worst-birthday/birthday_calculator.png'
import mediFront from './assets/medi-cal/front.png'
import mediLogin from './assets/medi-cal/login.png'
import mediServices from './assets/medi-cal/services.png'
import mediLifestyle from './assets/medi-cal/lifestyle.png'
import mediSchedule from './assets/medi-cal/schedule.png'
import mediBooking from './assets/medi-cal/booking.png'
import { useEffect, useState } from 'react'
import './App.css'

export default function App() {
  const [theme, setTheme] = useState('dark')

  const [imageIndexes, setImageIndexes] = useState({})

  const getImageIndex = (projectTitle) => {
    return imageIndexes[projectTitle] || 0
  }

  const nextImage = (projectTitle, imageCount) => {
    setImageIndexes(currentIndexes => ({
      ...currentIndexes,
      [projectTitle]: ((currentIndexes[projectTitle] || 0) + 1) % imageCount
    }))
  }

  const previousImage = (projectTitle, imageCount) => {
    setImageIndexes(currentIndexes => ({
      ...currentIndexes,
      [projectTitle]:
        (currentIndexes[projectTitle] || 0) === 0
          ? imageCount - 1
          : (currentIndexes[projectTitle] || 0) - 1
    }))
  }

  const goToImage = (projectTitle, index) => {
    setImageIndexes(currentIndexes => ({
      ...currentIndexes,
      [projectTitle]: index
    }))
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'))
  }

  const name = 'Kunyuan Hu'

  const projects = [
    {
      title: 'Medi-Cal Scheduling',
      description:
        'A clean scheduling-focused website designed to organize and manage medical appointment workflows. Features include a personal calendar, booking and new or followup checkups, and deleting appointments.',
      tech: ['Python', 'CSS', 'HTML', 'JavaScript'],
      type: 'Software Project',
      github: 'https://github.com/Kunyuan1/Medi-Cal_Scheduling',
      images: [
        mediFront,
        mediLogin,
        mediServices,
        mediLifestyle,
        mediSchedule,
        mediBooking
      ]
    },
    {
      title: "Eric's Mansion",
      description:
        'A choose your own adventure game focused on building an interactive experience with creative gameplay elements.',
      tech: ['Python', 'Cython', 'C++'],
      type: 'Game Project',
      github: 'https://github.com/Kunyuan1/Erics_Mansion',
      images: [gameFront, gameStart, gameBasement, gameLiving]
    },
    {
      title: 'Worst Birthday UI',
      description:
        'A user interface project exploring intentionally difficult or unconventional UI design choices. It incorporates many elements such as blackjack, reaction tests, and math minigames.',
      tech: ['Python', 'Cython', 'C++'],
      type: 'UI Project',
      github: 'https://github.com/Kunyuan1/Worst-Birthday-UI',
      images: [birthdayInput, birthdayBlackjack, birthdayCalculator]
    }
  ]

  const skills = ['Python', 'C++', 'JavaScript', 'HTML', 'CSS', 'React', 'Git']

  return (
    <div className="site">
      <header className="navbar">
        <div className="container nav-inner">
          <div className="nav-brand">Kunyuan Hu</div>

          <nav className="nav-links">
            <a href="#about">About</a>
            <a href="#projects">Projects</a>
            <a href="#skills">Skills</a>
            <a href="#contact">Contact</a>

            <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === 'dark' ? '☼' : '☾'}
            </button>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="container hero-content">
            <p className="eyebrow">Student Developer</p>
            <h1>
              Kunyuan Hu<br />
            </h1>
            <p className="hero-sub">
              Thin noodles are the best form of noodles.
            </p>

            <div className="hero-buttons">
              <a href="#projects" className="btn primary">View Projects</a>
              <a href="#contact" className="btn secondary">Contact</a>
            </div>
          </div>
        </section>

        <section id="about" className="section">
          <div className="container narrow">
            <p className="section-label">About</p>
            <h2>About Me</h2>
            <div className="panel">
              <p>
                Hi, I'm Kunyuan. I'm studying computer science and statistics at the University of Toronto Mississauga. I have a passion for game development and artificial intelligence.

              </p>
              <p>
                Outside of coding, I love working out, playing video games, and singing. I enjoy building projects that combine creativity, problem solving, and clean software design.

              </p>
            </div>
          </div>
        </section>

        <section id="projects" className="section projects-section">
          <div className="container">
            <p className="section-label">Selected Work</p>
            <h2>Featured Projects</h2>

            <div className="projects-grid upgraded-projects">
              {projects.map(project => (
                <article className="project-card upgraded-card" key={project.title}>
                  
                  {/* 🔥 IMAGE / PREVIEW */}
                  <div className="project-preview">
                    {project.images ? (
                      <div className="image-carousel">
                        <img
                          src={project.images[getImageIndex(project.title)]}
                          alt={`${project.title} screenshot ${getImageIndex(project.title) + 1}`}
                          className="carousel-image"
                        />

                        <button
                          className="carousel-button carousel-button-left"
                          onClick={() => previousImage(project.title, project.images.length)}
                          type="button"
                          aria-label="Previous image"
                        >
                          ‹
                        </button>

                        <button
                          className="carousel-button carousel-button-right"
                          onClick={() => nextImage(project.title, project.images.length)}
                          type="button"
                          aria-label="Next image"
                        >
                          ›
                        </button>

                        <div className="carousel-dots">
                          {project.images.map((image, index) => (
                            <button
                              key={image}
                              className={index === getImageIndex(project.title) ? 'dot active-dot' : 'dot'}
                              onClick={() => goToImage(project.title, index)}
                              type="button"
                              aria-label={`Go to image ${index + 1}`}
                            />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="preview-window">
                        <div className="preview-bar">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                        <div className="preview-content">
                          <div className="preview-line wide"></div>
                          <div className="preview-line"></div>
                          <div className="preview-grid">
                            <div></div>
                            <div></div>
                            <div></div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <p className="project-type">{project.type}</p>
                  <h3>{project.title}</h3>
                  <p>{project.description}</p>

                  <div className="tech-list">
                    {project.tech.map(item => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>

                  <div className="project-actions">
                    <a
                      href={project.github}
                      onClick={(event) => {
                        event.preventDefault()
                        window.open(project.github, '_blank', 'noopener,noreferrer')
                      }}
                      className="project-button github-button"
                    >
                      GitHub <span className="arrow">→</span>
                    </a>
                  </div>

                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="skills" className="section">
          <div className="container">
            <p className="section-label">Skills</p>
            <h2>What I Work With</h2>

            <div className="skills-grid">
              {skills.map(skill => (
                <div className="skill-card" key={skill}>
                  {skill}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" className="section">
          <div className="container narrow">
            <p className="section-label">Contact</p>
            <h2>Let’s Connect</h2>

            <div className="panel contact-panel">
              <p>Feel free to reach out! I’m always open to opportunities and collaborations.</p>
              <div className="contact-links">
                <a
                  href="mailto:kunyuanhu01@gmail.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="contact-link"
                >
                  Email <span className="arrow">→</span>
                </a>

                <a
                  href="https://github.com/Kunyuan1"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="contact-link"
                >
                  GitHub <span className="arrow">→</span>
                </a>

                <a
                  href="https://www.linkedin.com/in/kunyuan-hu-2a088430a/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="contact-link"
                >
                  LinkedIn <span className="arrow">→</span>
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}