import { useState } from 'react'
import { Paw, FlowerDoodle } from './Doodles'
import HandwrittenNote from './HandwrittenNote'

const colors = [
  { name: 'Laranja', hex: '#FF8C42' },
  { name: 'Amarelo', hex: '#FFD166' },
  { name: 'Lilás', hex: '#C9A7EB' },
  { name: 'Rosa', hex: '#F48FB1' },
  { name: 'Vermelho', hex: '#EF5350' },
  { name: 'Azul', hex: '#42A5F5' },
  { name: 'Verde', hex: '#66BB6A' },
]

export default function ColorsSection() {
  const [active, setActive] = useState(null)

  return (
    <section id="cores" className="relative bg-verde-menta py-20 md:py-28 px-4 overflow-hidden">
      {/* Doodles */}
      <Paw className="absolute top-12 right-12 text-verde/20 animate-float" size={30} />
      <FlowerDoodle className="absolute bottom-16 left-8 text-verde/20 animate-float-slow" size={34} />

      <div className="max-w-4xl mx-auto text-center">
        <div className="animate-on-scroll">
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-texto mb-4">
            Escolha a cor perfeita
          </h2>
          <p className="font-body text-texto/60 text-lg mb-12 max-w-md mx-auto">
            Sete cores vibrantes para combinar com a decoração da sua casa
          </p>
        </div>

        {/* Color circles */}
        <div className="flex flex-wrap justify-center gap-6 md:gap-10 mb-8 animate-on-scroll">
          {colors.map((c) => (
            <div
              key={c.name}
              className="flex flex-col items-center gap-2"
              onMouseEnter={() => setActive(c.name)}
              onMouseLeave={() => setActive(null)}
            >
              <div
                className="color-circle w-16 h-16 md:w-20 md:h-20 rounded-full shadow-md border-4 border-white"
                style={{ backgroundColor: c.hex }}
              />
              <span
                className={`font-handwritten text-lg transition-all duration-300 ${
                  active === c.name ? 'opacity-100 scale-110 text-texto' : 'opacity-0 scale-90'
                }`}
              >
                {c.name}
              </span>
            </div>
          ))}
        </div>

        {/* Active color preview */}
        <div className="h-20 flex items-center justify-center">
          {active && (
            <div
              className="inline-block px-6 py-3 rounded-full font-handwritten text-xl text-white shadow-lg transition-all duration-300"
              style={{ backgroundColor: colors.find((c) => c.name === active)?.hex }}
            >
              Floral Bowl {active}
            </div>
          )}
        </div>

        <HandwrittenNote rotate={3} className="mt-4">
          combina com qualquer decoração 🎨
        </HandwrittenNote>
      </div>
    </section>
  )
}
