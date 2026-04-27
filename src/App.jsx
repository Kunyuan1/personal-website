import { useEffect, useState } from 'react'
import './App.css'

export default function App() {
  const [theme, setTheme] = useState('dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'))
  }

  const projects = [
    {
      title: 'Personal Portfolio Website',
      description:
        'A polished React portfolio with dark/light mode, responsive design, and a minimal Apple-inspired interface.',
      tech: ['React', 'CSS', 'Responsive Design'],
      type: 'Featured Project',
      live: '#',
      github: '#'
    },
    {
      title: 'Python Projects',
      description:
        'A collection of Python programs focused on problem solving, object-oriented programming, and clean logic.',
      tech: ['Python', 'OOP', 'Algorithms'],
      type: 'Programming',
      live: '#',
      github: '#'
    },
    {
      title: 'CS Coursework',
      description:
        'Selected academic work involving data structures, recursion, testing, debugging, and software design.',
      tech: ['Data Structures', 'Testing', 'Debugging'],
      type: 'Computer Science',
      live: '#',
      github: '#'
    }
  ]

  const skills = ['React', 'JavaScript', 'Python', 'HTML', 'CSS', 'Git', 'Problem Solving', 'Software Design']

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
              Clean design.<br />
              Clear thinking.<br />
              Thoughtful software.
            </h1>
            <p className="hero-sub">
              I build clean, modern web experiences and practical software projects.
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
                I am a student interested in programming, software development,
                and building projects that are both useful and visually polished.
              </p>
              <p>
                I enjoy learning computer science concepts deeply and applying them
                through projects involving web development, Python, and problem solving.
              </p>
            </div>
          </div>
        </section>

        <section id="projects" className="section projects-section">
          <div className="container">
            <p className="section-label">Selected Work</p>
            <h2>Featured Projects</h2>

            <article className="featured-project">
              <div className="project-preview large-preview">
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
              </div>

              <div className="featured-project-info">
                <p className="project-type">Featured Project</p>
                <h3>Personal Portfolio Website</h3>
                <p>
                  A polished React portfolio with dark/light mode, responsive layouts,
                  clean typography, and a minimal Apple-inspired interface.
                </p>

                <div className="tech-list">
                  <span>React</span>
                  <span>CSS</span>
                  <span>Responsive Design</span>
                </div>

                <div className="project-actions">
                  <a href="#" className="project-button primary-project-button">
                    Live Demo
                  </a>
                  <a href="#" className="project-button secondary-project-button">
                    GitHub
                  </a>
                </div>
              </div>
            </article>

            <div className="projects-grid upgraded-projects">
              {projects.slice(1).map(project => (
                <article className="project-card upgraded-card" key={project.title}>
                  <div className="project-preview">
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
                    <a href={project.live} className="project-button primary-project-button">
                      Live Demo
                    </a>
                    <a href={project.github} className="project-button secondary-project-button">
                      GitHub
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
              <p>Replace these with your real email, GitHub, and LinkedIn later.</p>

              <div className="contact-links">
                <a href="mailto:your-email@example.com">Email</a>
                <a href="https://github.com/yourusername" target="_blank" rel="noreferrer">GitHub</a>
                <a href="https://www.linkedin.com/" target="_blank" rel="noreferrer">LinkedIn</a>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}