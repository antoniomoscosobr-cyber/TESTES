import { WaveDivider, Paw, Arrow, Sparkle } from './Doodles'
import Sticker from './Sticker'

const postIts = [
  { text: '🌱 Material PETG GF — resistência profissional', bg: 'bg-amarelo/30', rotate: -2 },
  { text: '🖨️ Impressão 3D — precisão e qualidade', bg: 'bg-azul/20', rotate: 1.5 },
  { text: '🌸 Design floral exclusivo', bg: 'bg-rosa/25', rotate: -1 },
  { text: '🐾 Bowl de inox removível — fácil de limpar', bg: 'bg-verde-menta', rotate: 2.5 },
  { text: '🏠 Decora qualquer ambiente', bg: 'bg-lilas/25', rotate: -1.5 },
]

export default function Differentials() {
  return (
    <section id="diferenciais" className="relative">
      <WaveDivider fill="#FFFFFF" />
      <div className="bg-white py-20 md:py-28 px-4 relative overflow-hidden">
        {/* Doodles */}
        <Paw className="absolute top-16 left-8 text-rosa-pastel animate-float" size={26} />
        <Sparkle className="absolute bottom-20 right-12 text-amarelo/40 animate-float-slow" size={20} />
        <Arrow className="absolute top-24 right-[10%] text-rosa-escuro/20 animate-float-reverse hidden md:block" size={50} />

        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14 animate-on-scroll">
            <h2 className="font-handwritten text-4xl md:text-5xl lg:text-6xl text-texto mb-3">
              Por que escolher o Floral Bowl?
            </h2>
            <p className="font-body text-texto/60 text-lg">
              Cada detalhe pensado para seu pet e sua casa
            </p>
          </div>

          {/* Post-its moodboard */}
          <div className="flex flex-wrap justify-center gap-5 md:gap-8 max-w-4xl mx-auto mb-10">
            {postIts.map((item, i) => (
              <div
                key={i}
                className={`post-it ${item.bg} rounded-md w-full sm:w-56 md:w-60 animate-on-scroll`}
                style={{
                  transform: `rotate(${item.rotate}deg)`,
                  transitionDelay: `${i * 80}ms`,
                }}
              >
                <p className="font-body text-texto text-base md:text-lg leading-relaxed font-medium">
                  {item.text}
                </p>
              </div>
            ))}
          </div>

          {/* Sticker */}
          <div className="flex justify-center animate-on-scroll">
            <Sticker bg="bg-rosa-escuro" className="text-white text-base w-28 h-28" rotate={-8}>
              Pet Home Decor
            </Sticker>
          </div>
        </div>
      </div>
      <WaveDivider fill="#FDE8EF" flip />
    </section>
  )
}
