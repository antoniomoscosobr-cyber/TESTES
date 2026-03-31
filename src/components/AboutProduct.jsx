import { WaveDivider, Paw, Heart, Sparkle } from './Doodles'
import HandwrittenNote from './HandwrittenNote'

const productColors = [
  { name: 'Laranja', color: '#FF8C42', rotate: -3 },
  { name: 'Lilás', color: '#C9A7EB', rotate: 2 },
  { name: 'Rosa', color: '#F48FB1', rotate: -1 },
  { name: 'Verde', color: '#66BB6A', rotate: 3 },
]

const features = [
  { icon: '💪', title: 'Resistência', desc: 'Material PETG GF de alta performance' },
  { icon: '✨', title: 'Design Exclusivo', desc: 'Formato floral único e patenteado' },
  { icon: '🧼', title: 'Higiênico', desc: 'Bowl de inox removível e lavável' },
  { icon: '🏡', title: 'Decorativo', desc: 'Peça de decoração para sua casa' },
]

export default function AboutProduct() {
  return (
    <section id="sobre" className="relative">
      <WaveDivider fill="#FFFFFF" />
      <div className="bg-white pt-16 pb-20 px-4 md:px-8 relative overflow-hidden">
        {/* Floating doodles */}
        <Paw className="absolute top-20 right-8 text-rosa-pastel/50 animate-float" size={28} />
        <Heart className="absolute bottom-20 left-8 text-rosa/30 animate-float-slow" size={22} />
        <Sparkle className="absolute top-40 left-[15%] text-amarelo/30 animate-float-reverse" size={16} />

        <div className="max-w-6xl mx-auto">
          {/* Title */}
          <div className="text-center mb-12 animate-on-scroll">
            <h2 className="font-handwritten text-4xl md:text-5xl lg:text-6xl text-texto mb-3">
              Feito com carinho (e tecnologia)
            </h2>
            <p className="font-body text-texto/60 text-lg max-w-lg mx-auto">
              Cada Floral Bowl é impresso em 3D com PETG GF, um material de alta resistência e acabamento superior.
              O design floral transforma o comedouro do seu pet em uma peça de decoração.
            </p>
          </div>

          {/* Polaroid Grid */}
          <div className="flex flex-wrap justify-center gap-6 md:gap-8 mb-16">
            {productColors.map((item, i) => (
              <div
                key={item.name}
                className="polaroid w-40 md:w-52 animate-on-scroll"
                style={{
                  transform: `rotate(${item.rotate}deg)`,
                  transitionDelay: `${i * 100}ms`,
                }}
              >
                <div className="tape" />
                {/* Product placeholder */}
                <div
                  className="w-full aspect-square rounded-md flex items-center justify-center relative overflow-hidden"
                  style={{ background: `${item.color}22` }}
                >
                  <div
                    className="w-24 h-24 md:w-28 md:h-28 rounded-full relative"
                    style={{ background: `${item.color}66` }}
                  >
                    {[0, 72, 144, 216, 288].map((deg, j) => (
                      <div
                        key={j}
                        className="absolute w-8 h-8 rounded-full"
                        style={{
                          background: `${item.color}88`,
                          top: '50%',
                          left: '50%',
                          transform: `rotate(${deg}deg) translate(32px) translate(-50%, -50%)`,
                        }}
                      />
                    ))}
                    <div className="absolute inset-[28%] rounded-full bg-gray-300/70" />
                  </div>
                </div>
                <p className="font-handwritten text-center text-lg mt-2 text-texto/70">{item.name}</p>
              </div>
            ))}
          </div>

          {/* Handwritten note */}
          <div className="text-center mb-12">
            <HandwrittenNote rotate={-2} className="text-2xl md:text-3xl">
              seu pet merece estilo ✨
            </HandwrittenNote>
          </div>

          {/* Feature icons */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 max-w-4xl mx-auto">
            {features.map((feat, i) => (
              <div
                key={feat.title}
                className="text-center animate-on-scroll"
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <div className="text-4xl md:text-5xl mb-3">{feat.icon}</div>
                <h3 className="font-display text-lg font-semibold text-texto mb-1">{feat.title}</h3>
                <p className="font-body text-sm text-texto/60">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <WaveDivider fill="#E8F5E9" flip />
    </section>
  )
}
