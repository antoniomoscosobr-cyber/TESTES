export default function Logo({ white = false }) {
  const textColor = white ? '#FFFFFF' : '#3B8BF5'
  const subColor = white ? 'rgba(255,255,255,0.8)' : '#666'

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="120" height="50" viewBox="0 0 120 50">
        {/* m.m text */}
        <text
          x="60"
          y="35"
          textAnchor="middle"
          fontFamily="'Playfair Display', serif"
          fontSize="36"
          fontWeight="700"
          fill={textColor}
        >
          m.m
        </text>
        {/* Cat ear on first m */}
        <path d="M18 18 L22 8 L28 16" fill="none" stroke={textColor} strokeWidth="2" strokeLinecap="round" />
        {/* Dog ear on last m */}
        <path d="M88 18 Q92 6 98 14" fill="none" stroke={textColor} strokeWidth="2" strokeLinecap="round" />
        {/* Cat tail */}
        <path d="M38 38 Q42 45 48 42" fill="none" stroke={textColor} strokeWidth="1.5" strokeLinecap="round" />
        {/* Dog tail */}
        <path d="M80 38 Q84 46 90 40" fill="none" stroke={textColor} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span
        className="text-[10px] tracking-[3px] uppercase font-semibold"
        style={{ color: subColor }}
      >
        Pet Home Decor
      </span>
    </div>
  )
}
