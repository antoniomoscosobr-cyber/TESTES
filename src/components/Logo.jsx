export default function Logo({ white = false, size = 160 }) {
  const blue = white ? '#FFFFFF' : '#3B8BF5'
  const darkBlue = white ? 'rgba(255,255,255,0.7)' : '#1a5dc7'
  const animalColor = white ? '#3B8BF5' : '#FFFFFF'
  const animalDark = white ? '#1a5dc7' : '#1a3a5c'
  const subColor = white ? 'rgba(255,255,255,0.8)' : '#666'
  const height = size * 0.55

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={height} viewBox="0 0 320 176" fill="none">
        {/* First M */}
        <path
          d="M8 170 L8 60 Q8 10 40 10 Q65 10 65 50 L65 170 L65 50 Q65 10 95 10 Q120 10 120 50 L120 170"
          fill="none"
        />
        {/* First M - filled shape */}
        <path
          d="M0 170 L0 55 Q0 0 38 0 Q70 0 72 40 Q74 0 108 0 Q140 0 140 55 L140 170 L120 170 L120 55 Q120 20 108 20 Q88 20 88 55 L88 170 L52 170 L52 55 Q52 20 38 20 Q20 20 20 55 L20 170 Z"
          fill={blue}
        />

        {/* Cat in first M - left arch */}
        <g transform="translate(12, 28)">
          {/* Cat body */}
          <path d="M8 130 L8 40 Q8 10 26 10 Q44 10 44 40 L44 130 Z" fill={animalColor} />
          {/* Cat ears */}
          <path d="M12 42 L18 12 L26 38" fill={animalColor} />
          <path d="M26 42 L34 14 L40 40" fill={animalColor} />
          {/* Cat eyes */}
          <ellipse cx="20" cy="55" rx="3.5" ry="4.5" fill={animalDark} />
          <ellipse cx="34" cy="55" rx="3.5" ry="4.5" fill={animalDark} />
          {/* Cat nose */}
          <ellipse cx="27" cy="66" rx="2" ry="1.5" fill={animalDark} />
        </g>

        {/* Dog in first M - right arch */}
        <g transform="translate(56, 28)">
          {/* Dog body */}
          <path d="M8 130 L8 40 Q8 10 28 10 Q48 10 48 40 L48 130 Z" fill={animalColor} />
          {/* Dog ears - floppy */}
          <path d="M10 38 Q4 20 14 14 Q20 10 22 30" fill={animalColor} />
          <path d="M36 30 Q38 10 44 14 Q52 20 46 38" fill={animalColor} />
          {/* Dog eyes */}
          <ellipse cx="20" cy="52" rx="3.5" ry="4.5" fill={animalDark} />
          <ellipse cx="38" cy="52" rx="3.5" ry="4.5" fill={animalDark} />
          {/* Dog nose */}
          <ellipse cx="29" cy="64" rx="3" ry="2.5" fill={animalDark} />
          {/* Dog mouth - smile */}
          <path d="M22 70 Q29 80 36 70" fill="none" stroke={animalDark} strokeWidth="2" strokeLinecap="round" />
        </g>

        {/* Dot between m's */}
        <circle cx="156" cy="150" r="14" fill={blue} />
        <ellipse cx="152" cy="146" rx="4" ry="5" fill={darkBlue} opacity="0.3" transform="rotate(-30 152 146)" />

        {/* Second M */}
        <path
          d="M172 170 L172 55 Q172 0 210 0 Q242 0 244 40 Q246 0 280 0 Q312 0 312 55 L312 170 L292 170 L292 55 Q292 20 280 20 Q260 20 260 55 L260 170 L224 170 L224 55 Q224 20 210 20 Q192 20 192 55 L192 170 Z"
          fill={blue}
        />

        {/* Cat in second M - left arch */}
        <g transform="translate(184, 28)">
          <path d="M8 130 L8 40 Q8 10 26 10 Q44 10 44 40 L44 130 Z" fill={animalColor} />
          <path d="M12 42 L18 12 L26 38" fill={animalColor} />
          <path d="M26 42 L34 14 L40 40" fill={animalColor} />
          <ellipse cx="20" cy="55" rx="3.5" ry="4.5" fill={animalDark} />
          <ellipse cx="34" cy="55" rx="3.5" ry="4.5" fill={animalDark} />
          <ellipse cx="27" cy="66" rx="2" ry="1.5" fill={animalDark} />
        </g>

        {/* Dog in second M - right arch */}
        <g transform="translate(228, 28)">
          <path d="M8 130 L8 40 Q8 10 28 10 Q48 10 48 40 L48 130 Z" fill={animalColor} />
          <path d="M10 38 Q4 20 14 14 Q20 10 22 30" fill={animalColor} />
          <path d="M36 30 Q38 10 44 14 Q52 20 46 38" fill={animalColor} />
          <ellipse cx="20" cy="52" rx="3.5" ry="4.5" fill={animalDark} />
          <ellipse cx="38" cy="52" rx="3.5" ry="4.5" fill={animalDark} />
          <ellipse cx="29" cy="64" rx="3" ry="2.5" fill={animalDark} />
          <path d="M22 70 Q29 80 36 70" fill="none" stroke={animalDark} strokeWidth="2" strokeLinecap="round" />
        </g>
      </svg>
      <span
        className="text-[11px] tracking-[4px] uppercase font-semibold"
        style={{ color: subColor }}
      >
        Pet Home Decor
      </span>
    </div>
  )
}
