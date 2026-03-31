export function Paw({ className = '', size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <ellipse cx="7" cy="8" rx="2.5" ry="3" />
      <ellipse cx="12" cy="6" rx="2.5" ry="3" />
      <ellipse cx="17" cy="8" rx="2.5" ry="3" />
      <ellipse cx="5" cy="13" rx="2" ry="2.5" />
      <ellipse cx="19" cy="13" rx="2" ry="2.5" />
      <path d="M7 17c0-3 2.5-5 5-5s5 2 5 5c0 2-1.5 4-5 4s-5-2-5-4z" />
    </svg>
  )
}

export function Heart({ className = '', size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  )
}

export function Star({ className = '', size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7L12 16.4 5.7 21l2.3-7L2 9.4h7.6z" />
    </svg>
  )
}

export function Sparkle({ className = '', size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 0l2 8 8 2-8 2-2 8-2-8-8-2 8-2z" />
    </svg>
  )
}

export function Leaf({ className = '', size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66c.57-1.79 1.42-3.65 2.72-5.18C10.6 14.32 13.32 13 17 13V8z" opacity="0.7" />
      <path d="M17 8c4-1 6-4 6-4s-3-1-6 0-6 4-6 4 3 1 6 0z" />
    </svg>
  )
}

export function Arrow({ className = '', size = 40 }) {
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 60 36" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className}>
      <path d="M5 20 Q 20 5, 35 18 T 55 15" />
      <path d="M48 10 L 55 15 L 48 20" />
    </svg>
  )
}

export function WaveDivider({ fill = '#E8F5E9', flip = false }) {
  return (
    <div className={`w-full overflow-hidden leading-[0] ${flip ? 'rotate-180' : ''}`}>
      <svg
        viewBox="0 0 1200 120"
        preserveAspectRatio="none"
        className="w-full h-[60px] md:h-[80px]"
      >
        <path
          d="M0,60 C150,120 350,0 500,60 C650,120 800,20 1000,60 C1100,80 1150,40 1200,60 L1200,120 L0,120Z"
          fill={fill}
        />
      </svg>
    </div>
  )
}

export function BlobShape({ className = '', color = '#F48FB1' }) {
  return (
    <svg viewBox="0 0 200 200" className={className}>
      <path
        fill={color}
        d="M45.3,-58.2C57.9,-49.6,67,-34.2,71.5,-17.3C76,-.5,75.9,18.8,68.1,33.8C60.3,48.8,44.8,59.5,28.3,65.5C11.8,71.4,-5.7,72.6,-22.2,67.8C-38.7,63,-54.2,52.1,-63.2,37.3C-72.2,22.5,-74.7,3.8,-70.6,-12.7C-66.5,-29.2,-55.8,-43.5,-42.5,-52C-29.2,-60.5,-13.4,-63.2,2.2,-66C17.8,-68.7,32.7,-66.8,45.3,-58.2Z"
        transform="translate(100 100)"
        opacity="0.15"
      />
    </svg>
  )
}

export function FlowerDoodle({ className = '', size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className}>
      <circle cx="20" cy="12" r="6" fill="currentColor" opacity="0.6" />
      <circle cx="28" cy="18" r="6" fill="currentColor" opacity="0.6" />
      <circle cx="26" cy="28" r="6" fill="currentColor" opacity="0.6" />
      <circle cx="14" cy="28" r="6" fill="currentColor" opacity="0.6" />
      <circle cx="12" cy="18" r="6" fill="currentColor" opacity="0.6" />
      <circle cx="20" cy="20" r="5" fill="#FFD166" />
    </svg>
  )
}
