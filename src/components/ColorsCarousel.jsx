import { useState } from 'react'

const colors = [
  { name: 'Rosa', hex: '#F48FB1', image: '/TESTES/bowls/rosa.png' },
  { name: 'Vermelho', hex: '#EF5350', image: '/TESTES/bowls/vermelho.png' },
  { name: 'Azul', hex: '#42A5F5', image: '/TESTES/bowls/azul.png' },
  { name: 'Laranja', hex: '#FF8C42', image: '/TESTES/bowls/laranja.png' },
  { name: 'Verde', hex: '#66BB6A', image: '/TESTES/bowls/verde.png' },
  { name: 'Amarelo', hex: '#FFD166', image: '/TESTES/bowls/amarelo.png' },
  { name: 'Lilás', hex: '#C9A7EB', image: '/TESTES/bowls/lilás.png' },
]

export default function ColorsCarousel() {
  const [active, setActive] = useState(6) // lilás default

  return (
    <section id="cores" className="py-24 md:py-32 bg-branco">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-12 animate-on-scroll">
          <p className="text-sm tracking-[0.2em] uppercase text-lilas mb-3 font-medium">Cores</p>
          <h2 className="font-display text-4xl md:text-5xl font-semibold text-preto-suave">
            Escolha a sua <span className="italic text-lilas">cor favorita</span>
          </h2>
        </div>

        {/* Main image */}
        <div className="flex justify-center mb-10 animate-on-scroll">
          <div className="relative w-72 h-72 md:w-96 md:h-96">
            <img
              src={colors[active].image}
              alt={`Comedouro Floral ${colors[active].name}`}
              className="w-full h-full object-contain rounded-3xl transition-opacity duration-500"
            />
          </div>
        </div>

        {/* Color name */}
        <p className="text-center font-display text-2xl font-semibold text-preto-suave mb-8">
          {colors[active].name}
        </p>

        {/* Color circles carousel */}
        <div className="flex justify-center gap-4 md:gap-6 flex-wrap animate-on-scroll">
          {colors.map((color, i) => (
            <button
              key={color.name}
              onClick={() => setActive(i)}
              className={`w-12 h-12 md:w-14 md:h-14 rounded-full transition-all duration-300 border-2 ${
                active === i
                  ? 'scale-125 border-preto-suave shadow-lg'
                  : 'border-transparent hover:scale-110 hover:shadow-md'
              }`}
              style={{ backgroundColor: color.hex }}
              aria-label={`Cor ${color.name}`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
