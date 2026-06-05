export default function Nav({ page, setPage }) {
  const links = [
    { id: 'main',     label: 'Home'     },
    { id: 'projects', label: 'Projects' },
    { id: 'about',    label: 'About'    },
    { id: 'contact',  label: 'Contact'  },
  ]
  return (
    <nav className="site-nav">
      <a href="#" className="nav-logo" onClick={(e) => { e.preventDefault(); setPage('main') }}>KY</a>
      <ul className="nav-links">
        {links.map(({ id, label }) => (
          <li key={id}>
            <a
              href="#"
              className={page === id ? 'active' : ''}
              onClick={e => { e.preventDefault(); setPage(id) }}
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
