import useScrollAnimation from './hooks/useScrollAnimation'
import Hero from './components/Hero'
import Product from './components/Product'
import ForWhom from './components/ForWhom'
import HowItWorks from './components/HowItWorks'
import Testimonials from './components/Testimonials'
import Gallery from './components/Gallery'
import CTA from './components/CTA'
import Footer from './components/Footer'
import WhatsAppButton from './components/WhatsAppButton'

function App() {
  useScrollAnimation()

  return (
    <div className="overflow-x-hidden">
      <Hero />
      <Product />
      <ForWhom />
      <HowItWorks />
      <Testimonials />
      <Gallery />
      <CTA />
      <Footer />
      <WhatsAppButton />
    </div>
  )
}

export default App
