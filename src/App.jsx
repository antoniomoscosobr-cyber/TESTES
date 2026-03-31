import useScrollAnimation from './hooks/useScrollAnimation'
import Hero from './components/Hero'
import AboutProduct from './components/AboutProduct'
import ColorsSection from './components/ColorsSection'
import Differentials from './components/Differentials'
import Gallery from './components/Gallery'
import CTA from './components/CTA'
import Footer from './components/Footer'

function App() {
  useScrollAnimation()

  return (
    <div className="overflow-x-hidden">
      <Hero />
      <AboutProduct />
      <ColorsSection />
      <Differentials />
      <Gallery />
      <CTA />
      <Footer />
    </div>
  )
}

export default App
