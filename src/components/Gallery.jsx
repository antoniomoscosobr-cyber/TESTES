const images = [
  { label: 'Comedouro lilás em sala de estar', aspect: 'aspect-[4/3]' },
  { label: 'Detalhe do bowl de inox', aspect: 'aspect-square' },
  { label: 'Comedouro verde-sálvia na cozinha', aspect: 'aspect-square' },
  { label: 'Pet usando o comedouro', aspect: 'aspect-[4/3]' },
  { label: 'Comedouro branco em ambiente clean', aspect: 'aspect-[4/3]' },
  { label: 'Vista lateral do design floral', aspect: 'aspect-square' },
]

export default function Gallery() {
  return (
    <section className="py-24 md:py-32 bg-creme">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16 animate-on-scroll">
          <p className="text-sm tracking-[0.2em] uppercase text-lilas mb-3 font-medium">Galeria</p>
          <h2 className="font-display text-4xl md:text-5xl font-semibold text-preto-suave">
            Em cada detalhe,{' '}
            <span className="italic text-lilas">beleza</span>
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
          {images.map((img, i) => (
            <div
              key={i}
              className={`animate-on-scroll delay-${Math.min((i + 1) * 100, 400)} ${img.aspect} rounded-2xl img-placeholder hover:shadow-lg transition-shadow cursor-pointer`}
            >
              <span className="text-xs text-center px-4">{img.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
