/**
 * Ilustrasi vektor isometric "Under Construction" (konversi dari desain HTML asli).
 * Bagian 1: defs (gradasi/filter), awan latar, gear dekoratif, crane (mast + jib).
 */
export default function ConstructionIllustration() {
  return (
    <div className="w-full max-w-[620px] aspect-[16/11] relative select-none">
      <svg className="w-full h-full drop-shadow-sm" fill="none" viewBox="0 0 740 520" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* Laptop Frame Gradient */}
          <linearGradient id="laptopBezel" x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#0284C7" />
            <stop offset="100%" stopColor="#0369A1" />
          </linearGradient>
          {/* Laptop Inner Screen Gradient */}
          <linearGradient id="laptopScreen" x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#E0F2FE" />
            <stop offset="100%" stopColor="#F0F9FF" />
          </linearGradient>
          {/* Signboard Wood Gradient */}
          <linearGradient id="woodBoard" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#FBBF24" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
          {/* Drop Shadow Filter for realism */}
          <filter height="120%" id="softShadow" width="120%" x="-10%" y="-10%">
            <feDropShadow dx="0" dy="8" floodColor="#0f172a" floodOpacity="0.08" stdDeviation="6" />
          </filter>
        </defs>

        {/* 1. Background Clouds in scene */}
        <path d="M220 85 C220 75 230 65 245 65 C255 52 275 52 288 65 C300 63 315 72 315 85 Z" fill="#E0F2FE" />
        <path d="M490 65 C490 55 500 48 512 48 C522 38 540 38 550 48 C562 46 575 55 575 65 Z" fill="#E0F2FE" />
        <path d="M605 90 C605 82 612 75 622 75 C630 68 644 68 652 75 C662 74 670 82 670 90 Z" fill="#E0F2FE" opacity="0.8" />

        {/* 2. Background Decorative Giant Gear (Warm Soft Amber/Peach Silhouette) */}
        <g opacity="0.35" transform="translate(320, 210)">
          <path d="M-60 -20 L-45 -20 L-40 -40 L-20 -45 L-20 -60 L20 -60 L20 -45 L40 -40 L45 -20 L60 -20 L60 20 L45 20 L40 40 L20 45 L20 60 L-20 60 L-20 45 L-40 40 L-45 20 L-60 20 Z" fill="#FDE68A" transform="scale(2.2)" />
          <circle cx="0" cy="0" fill="#F8FAFC" r="60" />
        </g>

        {/* 3. Construction Crane Lattice & Tower */}
        {/* Crane Vertical Mast */}
        <rect fill="#F8FAFC" height="230" stroke="#94A3B8" strokeWidth="2.5" width="40" x="585" y="115" />
        {/* Truss Lattice Pattern on Crane Vertical Mast */}
        <g stroke="#94A3B8" strokeLinecap="round" strokeWidth="2">
          <line x1="585" x2="625" y1="120" y2="155" />
          <line x1="625" x2="585" y1="155" y2="190" />
          <line x1="585" x2="625" y1="190" y2="225" />
          <line x1="625" x2="585" y1="225" y2="260" />
          <line x1="585" x2="625" y1="260" y2="295" />
          <line x1="625" x2="585" y1="295" y2="330" />
          {/* Horizontal internal struts */}
          <line x1="585" x2="625" y1="155" y2="155" />
          <line x1="585" x2="625" y1="190" y2="190" />
          <line x1="585" x2="625" y1="225" y2="225" />
          <line x1="585" x2="625" y1="260" y2="260" />
          <line x1="585" x2="625" y1="295" y2="295" />
        </g>
        {/* Crane Horizontal Jib (Lattice Arm) */}
        <rect fill="#F8FAFC" height="28" stroke="#94A3B8" strokeWidth="2.5" width="220" x="430" y="115" />
        {/* Truss pattern for horizontal jib */}
        <g stroke="#94A3B8" strokeWidth="2">
          <line x1="430" x2="452" y1="143" y2="115" />
          <line x1="452" x2="474" y1="115" y2="143" />
          <line x1="474" x2="496" y1="143" y2="115" />
          <line x1="496" x2="518" y1="115" y2="143" />
          <line x1="518" x2="540" y1="143" y2="115" />
          <line x1="540" x2="562" y1="115" y2="143" />
          <line x1="562" x2="585" y1="143" y2="115" />
          <line x1="625" x2="648" y1="115" y2="143" />
        </g>
        {/* Crane Yellow Cabin / Turntable */}
        <rect fill="#F59E0B" height="42" rx="4" stroke="#D97706" strokeWidth="2" width="36" x="580" y="105" />
        <rect fill="#FEF3C7" height="18" rx="2" width="16" x="584" y="112" />
        {/* Crane Trolley and Hoist Cable */}
        <rect fill="#F59E0B" height="9" rx="1.5" width="18" x="438" y="139" />
        <line stroke="#64748B" strokeDasharray="3 2" strokeWidth="2" x1="447" x2="447" y1="148" y2="182" />
        {/* Hoist Triangle Hook */}
        <path d="M447 182 L433 205 L461 205 Z" fill="none" stroke="#64748B" strokeWidth="2" />

        {/* 4. Monitor / Laptop Body */}
        <rect fill="#0284C7" height="24" rx="7" width="240" x="350" y="325" />
        <path d="M360 340 L580 340 L590 355 L350 355 Z" fill="#0369A1" opacity="0.3" />
        <rect fill="url(#laptopBezel)" filter="url(#softShadow)" height="175" rx="14" stroke="#0284C7" strokeWidth="4" width="215" x="365" y="150" />
        <rect fill="url(#laptopScreen)" height="152" rx="8" width="195" x="375" y="160" />
        {/* Screen Elements: Gears & Progress Bar */}
        <g id="screenGears">
          {/* Purple Gear (Hoisted / Main) */}
          <g className="animate-spin-slow" transform="translate(447, 235)">
            <path d="M-12 -38 L12 -38 L10 -28 L24 -20 L34 -25 L45 -7 L37 2 L38 18 L48 27 L36 43 L22 36 L10 42 L8 52 L-10 52 L-10 42 L-22 36 L-36 43 L-46 27 L-36 18 L-36 2 L-45 -7 L-34 -25 L-22 -20 L-10 -28 Z" fill="#9D8DF1" />
            <circle cx="0" cy="0" fill="#E0F2FE" r="17" />
          </g>
          {/* Cyan Gear (Interlocking Companion) */}
          <g className="animate-spin-reverse" transform="translate(515, 240)">
            <path d="M-9 -26 L9 -26 L8 -18 L18 -13 L25 -17 L32 -5 L26 2 L27 13 L34 19 L25 30 L16 25 L8 29 L6 36 L-7 36 L-7 29 L-15 25 L-24 30 L-31 19 L-25 13 L-25 2 L-31 -5 L-25 -17 L-16 -13 L-7 -18 Z" fill="#0EA5E9" />
            <circle cx="0" cy="0" fill="#E0F2FE" r="12" />
          </g>
        </g>
        {/* Screen Bottom Progress Bar Frame */}
        <rect fill="#FFFFFF" height="12" rx="6" width="165" x="390" y="285" />
        {/* Animated Active Progress Bar (Cyan & Purple tone) */}
        <rect className="animate-progress" fill="#0EA5E9" height="8" rx="4" width="90" x="392" y="287" />

        {/* 5. Left Traffic Safety Cone */}
        <g filter="url(#softShadow)" transform="translate(360, 310)">
          <polygon fill="#F59E0B" points="12,75 58,75 50,22 20,22" />
          <polygon fill="#FFFFFF" points="16,60 54,60 50,47 20,47" />
          <polygon fill="#FFFFFF" points="21,38 49,38 47,28 23,28" />
          <rect fill="#F59E0B" height="7" rx="3" width="54" x="8" y="73" />
        </g>
        {/* 6. Right Traffic Safety Cone */}
        <g filter="url(#softShadow)" transform="translate(545, 310)">
          <polygon fill="#F59E0B" points="12,75 58,75 50,22 20,22" />
          <polygon fill="#FFFFFF" points="16,60 54,60 50,47 20,47" />
          <polygon fill="#FFFFFF" points="21,38 49,38 47,28 23,28" />
          <rect fill="#F59E0B" height="7" rx="3" width="54" x="8" y="73" />
        </g>
        {/* 7. Yellow Triangle Warning Hazard Sign (Foreground Left) */}
        <g filter="url(#softShadow)" transform="translate(305, 320)">
          <path d="M45 8 L85 75 A4 4 0 0 1 81 81 L9 81 A4 4 0 0 1 5 75 Z" fill="#FBBF24" stroke="#F59E0B" strokeLinejoin="round" strokeWidth="4" />
          <path d="M45 28 L45 52" stroke="#B45309" strokeLinecap="round" strokeWidth="4.5" />
          <circle cx="45" cy="65" fill="#B45309" r="3.5" />
        </g>
        {/* 8. Large Central Wooden Signboard */}
        <g filter="url(#softShadow)" transform="translate(420, 310)">
          <rect fill="#D97706" height="92" rx="2" width="10" x="15" y="10" />
          <rect fill="#D97706" height="92" rx="2" width="10" x="95" y="10" />
          <rect fill="url(#woodBoard)" height="58" rx="7" stroke="#D97706" strokeWidth="3" width="120" x="0" y="14" />
          <text fill="#B45309" fontFamily="'Plus Jakarta Sans', sans-serif" fontSize="13" fontWeight="900" letterSpacing="0.5" textAnchor="middle" x="60" y="38">
            UNDER
          </text>
          <text fill="#B45309" fontFamily="'Plus Jakarta Sans', sans-serif" fontSize="8.5" fontWeight="800" letterSpacing="0.5" textAnchor="middle" x="60" y="52">
            CONSTRUCTION
          </text>
        </g>
        {/* 9. Octagonal Yellow STOP / Hazard Sign (Foreground Right on Pole) */}
        <g filter="url(#softShadow)" transform="translate(590, 200)">
          <rect fill="#CBD5E1" height="150" width="6" x="36" y="70" />
          <polygon fill="#FBBF24" points="26,10 52,10 70,28 70,54 52,72 26,72 8,54 8,28" stroke="#F59E0B" strokeLinejoin="round" strokeWidth="4.5" />
          <path d="M39 25 L39 42" stroke="#B45309" strokeLinecap="round" strokeWidth="3.5" />
          <circle cx="39" cy="50" fill="#B45309" r="2.5" />
          <text fill="#B45309" fontFamily="'Plus Jakarta Sans', sans-serif" fontSize="7.5" fontWeight="900" letterSpacing="0.5" textAnchor="middle" x="39" y="61">
            STOP
          </text>
        </g>
        {/* Subtle ground line */}
        <ellipse cx="480" cy="405" fill="#E2E8F0" opacity="0.4" rx="260" ry="12" />
      </svg>
    </div>
  );
}
