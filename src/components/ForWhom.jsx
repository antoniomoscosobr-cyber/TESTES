export default function ForWhom() {
  return (
    <section className="py-24 md:py-32 bg-creme">
      <div className="max-w-5xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          {/* Image */}
          <div className="animate-on-scroll">
            <div className="w-full aspect-square rounded-3xl img-placeholder">
              <span>Foto de pet comendo no comedouro em ambiente decorado</span>
            </div>
          </div>

          {/* Text */}
          <div className="animate-on-scroll delay-200">
            <p className="text-sm tracking-[0.2em] uppercase text-lilas mb-3 font-medium">Para quem é</p>
            <h2 className="font-display text-4xl md:text-5xl font-semibold text-preto-suave mb-6 leading-tight">
              Para quem trata o pet
              <span className="italic text-lilas"> como parte do lar</span>
            </h2>
            <div className="space-y-4 text-texto-leve leading-relaxed">
              <p>
                Você escolhe cada objeto da sua casa com cuidado. Cada detalhe importa — a cor da almofada, o formato do vaso, a textura da toalha. E quando olha para o cantinho do seu pet, sente que ele também merece algo à altura.
              </p>
              <p>
                O Comedouro Floral foi criado para quem entende que cuidado e estética caminham juntos. Para quem quer que o espaço do pet converse com o restante da casa — sem abrir mão da praticidade e da durabilidade que o dia a dia exige.
              </p>
              <p>
                Porque seu pet não é só um animal. É família. E família merece o melhor.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
