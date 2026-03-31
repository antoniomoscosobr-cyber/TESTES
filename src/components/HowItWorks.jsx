const steps = [
  {
    number: '01',
    title: 'Escolha a cor',
    description: 'Selecione entre lilás, branco, preto, verde-sálvia e outras cores disponíveis.'
  },
  {
    number: '02',
    title: 'Faça seu pedido',
    description: 'Entre em contato pelo WhatsApp. Produção sob encomenda, peça por peça.'
  },
  {
    number: '03',
    title: 'Receba em casa',
    description: 'Entrega em até 5 dias úteis após confirmação. Produção nacional.'
  }
]

export default function HowItWorks() {
  return (
    <section className="py-24 md:py-32 bg-lilas-bg">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-16 animate-on-scroll">
          <p className="text-sm tracking-[0.2em] uppercase text-lilas mb-3 font-medium">Como funciona</p>
          <h2 className="font-display text-4xl md:text-5xl font-semibold text-preto-suave">
            Simples assim
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8 md:gap-12">
          {steps.map((step, i) => (
            <div key={step.number} className={`animate-on-scroll delay-${(i + 1) * 100} text-center`}>
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-branco flex items-center justify-center shadow-sm">
                <span className="font-display text-2xl font-semibold text-lilas">{step.number}</span>
              </div>
              <h3 className="font-display text-2xl font-semibold mb-3 text-preto-suave">{step.title}</h3>
              <p className="text-texto-leve leading-relaxed">{step.description}</p>

              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-8 -right-6">
                  <svg className="w-6 h-6 text-bege-escuro" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
