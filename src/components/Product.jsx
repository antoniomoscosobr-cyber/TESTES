const features = [
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    title: 'Material Premium',
    description: 'PETG com fibra de vidro — resistente à umidade e ao calor. Acabamento fosco natural.'
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
      </svg>
    ),
    title: 'Design Exclusivo',
    description: 'Formato floral criado pela marca — arquivo próprio, não é modelo público.'
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
      </svg>
    ),
    title: 'Bowl Inox Removível',
    description: 'Higiênico e fácil de lavar. Basta retirar, higienizar e recolocar.'
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
      </svg>
    ),
    title: 'Feito com Cuidado',
    description: 'Cada peça é impressa individualmente. 2,5 horas de produção dedicada.'
  }
]

export default function Product() {
  return (
    <section id="produto" className="py-24 md:py-32 bg-branco">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16 animate-on-scroll">
          <p className="text-sm tracking-[0.2em] uppercase text-lilas mb-3 font-medium">O Produto</p>
          <h2 className="font-display text-4xl md:text-5xl font-semibold text-preto-suave">
            Cada detalhe pensado<br />
            <span className="italic text-lilas">com carinho</span>
          </h2>
        </div>

        {/* Product detail image */}
        <div className="mb-16 animate-on-scroll">
          <div className="w-full h-64 md:h-96 rounded-3xl img-placeholder">
            <span>Foto close do acabamento fosco do comedouro</span>
          </div>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, i) => (
            <div
              key={feature.title}
              className={`animate-on-scroll delay-${(i + 1) * 100} bg-creme rounded-2xl p-6 text-center hover:shadow-md transition-shadow`}
            >
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-lilas-bg flex items-center justify-center text-lilas">
                {feature.icon}
              </div>
              <h3 className="font-display text-xl font-semibold mb-2 text-preto-suave">
                {feature.title}
              </h3>
              <p className="text-texto-leve text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
