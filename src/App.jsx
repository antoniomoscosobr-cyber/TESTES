import useScrollAnimation from './hooks/useScrollAnimation'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Product from './components/Product'
import ColorsCarousel from './components/ColorsCarousel'
import ForWhom from './components/ForWhom'
import HowItWorks from './components/HowItWorks'
import Testimonials from './components/Testimonials'
import Gallery from './components/Gallery'
import Footer from './components/Footer'
import WhatsAppButton from './components/WhatsAppButton'

function App() {
  useScrollAnimation()

  return (
    <div className="overflow-x-hidden">
      <Navbar />
      <Hero />
      <Product />
      <ColorsCarousel />
      <ForWhom />
      <HowItWorks />
      <Testimonials />
      <Gallery />
      <Footer />
      <WhatsAppButton />
    </div>
  )
}

export default App
