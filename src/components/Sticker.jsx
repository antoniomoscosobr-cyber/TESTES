export default function Sticker({ children, className = '', bg = 'bg-amarelo', rotate = -5 }) {
  return (
    <div
      className={`sticker ${bg} ${className}`}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      {children}
    </div>
  )
}
