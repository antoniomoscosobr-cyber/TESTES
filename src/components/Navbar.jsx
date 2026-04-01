import { useState } from 'react'

const navLinks = [
  { label: 'Produto', href: '#produto' },
  { label: 'Cores', href: '#cores' },
  { label: 'Como funciona', href: '#como-funciona' },
  { label: 'Galeria', href: '#galeria' },
  { label: 'Contato', href: '#contato' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 bg-creme/80 backdrop-blur-md border-b border-bege">
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
        {/* Logo */}
        <a href="#" className="flex items-center gap-2">
          <img
            src="/TESTES/Logo M.M.svg"
            alt="m.m Pet Home Decor"
            className="h-10 w-auto"
          />
        </a>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-texto-leve hover:text-lilas transition-colors font-medium"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setOpen(!open)}
          className="md:hidden flex flex-col gap-1.5 p-2"
          aria-label="Menu"
        >
          <span className={`block w-6 h-0.5 bg-texto transition-transform ${open ? 'rotate-45 translate-y-2' : ''}`} />
          <span className={`block w-6 h-0.5 bg-texto transition-opacity ${open ? 'opacity-0' : ''}`} />
          <span className={`block w-6 h-0.5 bg-texto transition-transform ${open ? '-rotate-45 -translate-y-2' : ''}`} />
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-creme border-b border-bege px-6 pb-4">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block py-3 text-sm text-texto-leve hover:text-lilas transition-colors font-medium border-b border-bege last:border-0"
            >
              {link.label}
            </a>
          ))}
        </div>
      )}
    </nav>
  )
}
