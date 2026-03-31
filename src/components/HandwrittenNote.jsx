export default function HandwrittenNote({ children, className = '', rotate = -3 }) {
  return (
    <span
      className={`font-handwritten text-xl md:text-2xl text-rosa-escuro inline-block ${className}`}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      {children}
    </span>
  )
}
