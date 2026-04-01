export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center bg-creme pt-16">
      <div className="max-w-7xl mx-auto px-6 py-20 md:py-0 grid md:grid-cols-2 gap-12 items-center w-full">
        {/* Text */}
        <div className="order-2 md:order-1">
          <p className="text-sm tracking-[0.2em] uppercase text-texto-leve mb-4 font-body">
            m.m Pet Home Decor
          </p>
          <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-semibold leading-[1.1] text-preto-suave mb-6">
            Seu pet merece
            <br />
            <span className="text-lilas italic">um lugar bonito</span>
            <br />
            para comer.
          </h1>
          <p className="text-texto-leve text-lg md:text-xl leading-relaxed mb-8 max-w-md">
            Comedouro floral impresso em 3D com material premium e bowl de inox removível. Feito à mão, peça por peça.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href="#cores"
              className="inline-flex items-center justify-center px-8 py-4 bg-preto-suave text-branco rounded-full text-sm font-medium tracking-wide hover:bg-texto transition-colors"
            >
              Ver cores disponíveis
            </a>
            <a
              href="#produto"
              className="inline-flex items-center justify-center px-8 py-4 border border-bege-escuro text-texto rounded-full text-sm font-medium tracking-wide hover:border-lilas hover:text-lilas transition-colors"
            >
              Conhecer o produto
            </a>
          </div>
        </div>

        {/* Product image */}
        <div className="order-1 md:order-2 flex justify-center">
          <div className="relative">
            <div className="w-72 h-72 md:w-96 md:h-96 rounded-full bg-lilas-bg flex items-center justify-center">
              <img
                src="/TESTES/bowls/lilas.png"
                alt="Comedouro Floral Pet Lilás"
                className="w-60 h-60 md:w-80 md:h-80 object-contain"
              />
            </div>
            {/* Price tag */}
            <div className="absolute -bottom-2 right-4 md:right-0 bg-branco rounded-2xl px-5 py-3 shadow-lg">
              <span className="text-xs text-texto-leve block">a partir de</span>
              <span className="font-display text-2xl font-semibold text-preto-suave">R$ 89</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
