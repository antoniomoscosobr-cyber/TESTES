import { Paw, Heart, Leaf, FlowerDoodle } from './Doodles'
import HandwrittenNote from './HandwrittenNote'

const galleryItems = [
  { label: 'Na sala de estar', color: '#FF8C42', rotate: -3, bg: '#FFF3E0' },
  { label: 'Na cozinha', color: '#42A5F5', rotate: 2, bg: '#E3F2FD' },
  { label: 'Pet feliz!', color: '#66BB6A', rotate: -1.5, bg: '#E8F5E9' },
  { label: 'Decoração perfeita', color: '#C9A7EB', rotate: 2.5, bg: '#F3E5F5' },
]

export default function Gallery() {
  return (
    <section id="galeria" className="relative bg-rosa-pastel py-20 md:py-28 px-4 overflow-hidden">
      {/* Doodles */}
      <Paw className="absolute top-12 left-[10%] text-rosa-escuro/20 animate-float" size={28} />
      <Heart className="absolute bottom-16 right-[15%] text-rosa/30 animate-float-slow" size={24} />
      <Leaf className="absolute top-24 right-[8%] text-verde-prod/30 animate-float-reverse" size={26} />
      <FlowerDoodle className="absolute bottom-24 left-[5%] text-lilas/30 animate-float" size={30} />

      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14 animate-on-scroll">
          <h2 className="font-handwritten text-4xl md:text-5xl lg:text-6xl text-texto mb-3">
            Na casa e no coração
          </h2>
          <p className="font-body text-texto/60 text-lg">
            O Floral Bowl em diferentes ambientes
          </p>
        </div>

        {/* Polaroid grid */}
        <div className="flex flex-wrap justify-center gap-6 md:gap-10">
          {galleryItems.map((item, i) => (
            <div
              key={i}
              className="polaroid w-44 md:w-56 animate-on-scroll"
              style={{
                transform: `rotate(${item.rotate}deg)`,
                transitionDelay: `${i * 120}ms`,
              }}
            >
              <div className="tape" style={{ left: i % 2 === 0 ? '30%' : '50%' }} />
              <div
                className="w-full aspect-[4/3] rounded-sm flex items-center justify-center relative"
                style={{ background: item.bg }}
              >
                {/* Simplified product illustration */}
                <div className="relative">
                  <div
                    className="w-20 h-20 md:w-24 md:h-24 rounded-full"
                    style={{ background: `${item.color}44` }}
                  >
                    {[0, 72, 144, 216, 288].map((deg, j) => (
                      <div
                        key={j}
                        className="absolute w-5 h-5 md:w-6 md:h-6 rounded-full"
                        style={{
                          background: `${item.color}77`,
                          top: '50%',
                          left: '50%',
                          transform: `rotate(${deg}deg) translate(26px) translate(-50%, -50%)`,
                        }}
                      />
                    ))}
                    <div className="absolute inset-[30%] rounded-full bg-gray-300/50" />
                  </div>
                </div>
                {/* Little paw in corner */}
                <Paw className="absolute bottom-2 right-2 text-texto/10" size={16} />
              </div>
              <p className="font-handwritten text-center text-lg mt-2 text-texto/60">{item.label}</p>
            </div>
          ))}
        </div>

        {/* Handwritten note */}
        <div className="text-center mt-10 animate-on-scroll">
          <HandwrittenNote rotate={-3} className="text-2xl md:text-3xl">
            cada cantinho fica mais fofo 🐾
          </HandwrittenNote>
        </div>
      </div>
    </section>
  )
}
