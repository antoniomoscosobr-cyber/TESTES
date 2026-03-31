import { Paw, Heart, Star, BlobShape, FlowerDoodle, Sparkle } from './Doodles'
import HandwrittenNote from './HandwrittenNote'
import Sticker from './Sticker'
import Logo from './Logo'

export default function Hero() {
  return (
    <section id="hero" className="relative min-h-screen bg-rosa-pastel flex flex-col items-center justify-center px-4 overflow-hidden">
      {/* Decorative blobs */}
      <BlobShape className="absolute top-0 right-0 w-80 h-80 md:w-[500px] md:h-[500px]" color="#F48FB1" />
      <BlobShape className="absolute bottom-10 left-0 w-60 h-60 md:w-96 md:h-96" color="#C9A7EB" />
      <BlobShape className="absolute top-1/3 left-10 w-40 h-40" color="#FFD166" />

      {/* Floating doodles */}
      <Paw className="absolute top-20 left-[10%] text-rosa-escuro/30 animate-float" size={32} />
      <Paw className="absolute top-40 right-[15%] text-rosa-escuro/20 animate-float-slow" size={24} />
      <Heart className="absolute bottom-32 left-[20%] text-vermelho/30 animate-float-reverse" size={28} />
      <Heart className="absolute top-28 right-[30%] text-rosa/40 animate-float" size={20} />
      <Star className="absolute bottom-40 right-[10%] text-amarelo/40 animate-float-slow" size={22} />
      <Star className="absolute top-52 left-[35%] text-amarelo/30 animate-float" size={16} />
      <FlowerDoodle className="absolute bottom-24 right-[25%] text-lilas/40 animate-float-reverse" size={36} />
      <Sparkle className="absolute top-32 left-[50%] text-azul/30 animate-float" size={18} />
      <Sparkle className="absolute bottom-48 left-[8%] text-verde-prod/30 animate-float-slow" size={14} />

      {/* Logo */}
      <div className="relative z-10 mb-6 md:mb-8">
        <Logo />
      </div>

      {/* Main content */}
      <div className="relative z-10 text-center max-w-3xl mx-auto">
        <h1 className="font-display text-6xl md:text-8xl lg:text-9xl font-bold text-texto tracking-tight mb-4">
          Floral Bowl
        </h1>
        <p className="font-body text-lg md:text-xl text-texto/70 mb-2 max-w-md mx-auto">
          Onde design encontra o amor pelo seu pet
        </p>
        <HandwrittenNote className="mb-8 block" rotate={2}>
          feito com muito amor 💕
        </HandwrittenNote>

        {/* Product placeholder */}
        <div className="relative inline-block mb-8">
          <div className="w-56 h-56 md:w-72 md:h-72 rounded-full bg-gradient-to-br from-verde-prod/60 to-verde-menta relative animate-float mx-auto shadow-xl">
            {/* Petals */}
            {[0, 60, 120, 180, 240, 300].map((deg, i) => (
              <div
                key={i}
                className="absolute w-14 h-14 md:w-18 md:h-18 rounded-full bg-rosa/60"
                style={{
                  top: '50%',
                  left: '50%',
                  transform: `rotate(${deg}deg) translate(70px) translate(-50%, -50%)`,
                }}
              />
            ))}
            {/* Center bowl */}
            <div className="absolute inset-[25%] rounded-full bg-gradient-to-br from-gray-300 to-gray-400 shadow-inner flex items-center justify-center">
              <span className="font-handwritten text-white text-lg md:text-xl font-bold drop-shadow">bowl</span>
            </div>
          </div>

          {/* 3D Sticker */}
          <Sticker
            bg="bg-azul-marca"
            className="absolute -top-4 -right-4 md:-right-8 text-white text-sm w-20 h-20"
            rotate={12}
          >
            Impresso em 3D
          </Sticker>
        </div>

        {/* CTA */}
        <div>
          <a
            href="#sobre"
            className="inline-block bg-rosa-escuro text-white font-semibold px-8 py-4 rounded-full text-lg hover:scale-110 hover:shadow-lg transition-all duration-300 hover:bg-rosa-escuro/90"
          >
            Conhecer ↓
          </a>
        </div>
      </div>

      {/* Paws trail at bottom */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-4 opacity-20">
        <Paw size={16} className="text-texto rotate-[-15deg]" />
        <Paw size={14} className="text-texto rotate-[10deg]" />
        <Paw size={16} className="text-texto rotate-[-5deg]" />
      </div>
    </section>
  )
}
