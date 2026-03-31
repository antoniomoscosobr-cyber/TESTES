export default function CTA() {
  return (
    <section id="encomendar" className="py-24 md:py-32 bg-preto-suave text-branco">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <div className="animate-on-scroll">
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-semibold mb-6 leading-tight">
            Pronto para dar ao seu pet
            <br />
            <span className="italic text-lilas-claro">o que ele merece?</span>
          </h2>
          <p className="text-lg md:text-xl text-gray-400 mb-10 max-w-xl mx-auto leading-relaxed">
            Cada comedouro é feito sob encomenda, com atenção a cada detalhe. Escolha sua cor e encomende pelo WhatsApp.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://wa.me/5500000000000?text=Ol%C3%A1!%20Gostaria%20de%20encomendar%20um%20Comedouro%20Floral%20Pet"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-3 px-8 py-4 bg-[#25D366] text-white rounded-full text-base font-medium hover:bg-[#20bd5a] transition-colors"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Encomendar pelo WhatsApp
            </a>
          </div>
          <p className="text-gray-500 text-sm mt-8">
            R$ 89,00 &middot; Entrega em até 5 dias úteis &middot; Produção nacional
          </p>
        </div>

        {/* Optional order form */}
        <div className="mt-20 animate-on-scroll">
          <h3 className="font-display text-2xl font-semibold mb-8 text-lilas-claro">
            Ou preencha o formulário de encomenda
          </h3>
          <form
            className="max-w-md mx-auto space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              const data = new FormData(e.target)
              const msg = `Olá! Gostaria de encomendar um Comedouro Floral Pet.\n\nNome: ${data.get('name')}\nE-mail: ${data.get('email')}\nCor desejada: ${data.get('color')}\nMensagem: ${data.get('message') || 'Sem mensagem adicional'}`
              const encoded = encodeURIComponent(msg)
              window.open(`https://wa.me/5500000000000?text=${encoded}`, '_blank')
            }}
          >
            <input
              name="name"
              type="text"
              placeholder="Seu nome"
              required
              className="w-full px-5 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-lilas-claro transition-colors"
            />
            <input
              name="email"
              type="email"
              placeholder="Seu e-mail"
              required
              className="w-full px-5 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-lilas-claro transition-colors"
            />
            <select
              name="color"
              required
              className="w-full px-5 py-3 rounded-xl bg-white/10 border border-white/20 text-gray-400 focus:outline-none focus:border-lilas-claro transition-colors"
            >
              <option value="">Cor desejada</option>
              <option value="Lilás">Lilás</option>
              <option value="Branco">Branco</option>
              <option value="Preto">Preto</option>
              <option value="Verde-sálvia">Verde-sálvia</option>
            </select>
            <textarea
              name="message"
              placeholder="Mensagem (opcional)"
              rows={3}
              className="w-full px-5 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-lilas-claro transition-colors resize-none"
            />
            <button
              type="submit"
              className="w-full px-8 py-4 bg-lilas text-white rounded-full font-medium hover:bg-lilas-claro hover:text-preto-suave transition-colors"
            >
              Enviar encomenda
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}
