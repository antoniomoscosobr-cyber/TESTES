const testimonials = [
  {
    name: 'Camila R.',
    pet: 'Mel — Golden Retriever',
    text: 'Ficou lindo no cantinho da Mel! O acabamento é impecável, parece peça de decoração. Amei.',
  },
  {
    name: 'Fernanda S.',
    pet: 'Mimi — Gata Persa',
    text: 'Comprei o lilás e combinou perfeitamente com minha cozinha. A Mimi adorou e eu mais ainda!',
  },
  {
    name: 'Juliana M.',
    pet: 'Thor — Bulldog Francês',
    text: 'A qualidade surpreendeu muito. Não parece nada com impressão 3D comum. Super recomendo.',
  }
]

export default function Testimonials() {
  return (
    <section className="py-24 md:py-32 bg-branco">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16 animate-on-scroll">
          <p className="text-sm tracking-[0.2em] uppercase text-lilas mb-3 font-medium">Depoimentos</p>
          <h2 className="font-display text-4xl md:text-5xl font-semibold text-preto-suave">
            O que dizem sobre nós
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((t, i) => (
            <div
              key={t.name}
              className={`animate-on-scroll delay-${(i + 1) * 100} bg-creme rounded-2xl p-8`}
            >
              {/* Pet photo placeholder */}
              <div className="w-16 h-16 rounded-full img-placeholder mb-5 mx-auto">
                <span className="text-xs">Foto</span>
              </div>
              <p className="text-texto leading-relaxed mb-5 text-center italic">
                &ldquo;{t.text}&rdquo;
              </p>
              <div className="text-center">
                <p className="font-medium text-preto-suave text-sm">{t.name}</p>
                <p className="text-texto-leve text-xs">{t.pet}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
