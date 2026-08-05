import React from "react";
import { ShieldCheck, Zap, Trophy, Lock, Megaphone } from "lucide-react";

interface PreLaunchCardProps {
  whatsappUrl?: string;
}

export const RifaMasterHookLogo: React.FC<{ className?: string; idPrefix?: string }> = ({
  className = "w-10 h-10",
  idPrefix = "plHook",
}) => {
  const gradId = `${idPrefix}GoldGrad`;
  const highlightId = `${idPrefix}Highlight`;
  const glowId = `${idPrefix}Glow`;

  return (
    <svg
      className={className}
      viewBox="0 0 110 110"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFF2B2" />
          <stop offset="25%" stopColor="#FFC247" />
          <stop offset="60%" stopColor="#FF8A00" />
          <stop offset="85%" stopColor="#FF5500" />
          <stop offset="100%" stopColor="#B32400" />
        </linearGradient>
        <linearGradient id={highlightId} x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="50%" stopColor="#FFD27F" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.6" />
        </linearGradient>
        <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow
            dx="2"
            dy="3"
            stdDeviation="2.5"
            floodOpacity="0.75"
            floodColor="#000000"
          />
        </filter>
      </defs>

      <g filter={`url(#${glowId})`}>
        {/* Outer sweeping circular swoosh rings */}
        <path
          d="M 76 16 C 56 10, 32 16, 24 35 M 20 48 C 20 78, 44 102, 74 102 C 86 102, 94 94, 98 86 C 102 78, 100 69, 100 69"
          stroke={`url(#${gradId})`}
          strokeWidth="4.8"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M 76 16 C 56 10, 32 16, 24 35"
          stroke={`url(#${highlightId})`}
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
        />

        {/* Anchor fluke */}
        <path
          d="M 23 35 Q 31 43, 38 35 L 29 51 C 23 63, 23 78, 41 85 L 31 85 C 13 78, 15 58, 19 49 Z"
          fill={`url(#${gradId})`}
        />

        {/* Fishing hook eyelet */}
        <circle
          cx="77"
          cy="27"
          r="6"
          stroke={`url(#${gradId})`}
          strokeWidth="5"
          fill="none"
        />

        {/* Main shank */}
        <path
          d="M 73 31 L 43 67 C 37 77, 47 90, 59 88 C 72 86, 79 74, 79 74"
          stroke={`url(#${gradId})`}
          strokeWidth="8.8"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M 73 31 L 43 67 C 37 77, 47 90, 59 88 C 72 86, 79 74, 79 74"
          stroke={`url(#${highlightId})`}
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.4"
        />

        {/* Barb */}
        <path
          d="M 79 74 L 83 54 L 69 62 Q 75 70, 79 74 Z"
          fill={`url(#${gradId})`}
        />
      </g>
    </svg>
  );
};

export const PreLaunchCard: React.FC<PreLaunchCardProps> = ({ whatsappUrl }) => {
  const targetGroupUrl =
    whatsappUrl || "https://chat.whatsapp.com/IiS1KhceTBC58bnrVCBueC";

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 my-6 sm:my-10 select-none">
      {/* Custom Inline CSS Animations for Pulsing Neon Effects */}
      <style>{`
        @keyframes neonGlowPulse {
          0%, 100% {
            opacity: 0.75;
            transform: scale(1);
            filter: blur(28px);
          }
          50% {
            opacity: 1;
            transform: scale(1.03);
            filter: blur(36px);
          }
        }
        @keyframes qMarkFloat {
          0%, 100% {
            transform: translateY(0px) scale(1);
          }
          50% {
            transform: translateY(-8px) scale(1.03);
          }
        }
        @keyframes beamBreathe {
          0%, 100% {
            opacity: 0.35;
          }
          50% {
            opacity: 0.65;
          }
        }
        @keyframes starTwinkle {
          0%, 100% {
            opacity: 0.3;
            transform: scale(0.8);
          }
          50% {
            opacity: 1;
            transform: scale(1.3);
          }
        }
        @keyframes buttonNeonGlow {
          0%, 100% {
            box-shadow: 0 10px 30px rgba(255,138,0,0.4), 0 0 15px rgba(255,138,0,0.2);
          }
          50% {
            box-shadow: 0 18px 45px rgba(255,138,0,0.65), 0 0 28px rgba(255,194,71,0.4);
          }
        }
        .animate-neon-glow {
          animation: neonGlowPulse 4.5s ease-in-out infinite;
        }
        .animate-qmark-float {
          animation: qMarkFloat 3.8s ease-in-out infinite;
        }
        .animate-beam-breathe {
          animation: beamBreathe 3s ease-in-out infinite;
        }
        .animate-star-1 {
          animation: starTwinkle 2.2s ease-in-out infinite;
        }
        .animate-star-2 {
          animation: starTwinkle 2.8s ease-in-out infinite 0.7s;
        }
        .animate-star-3 {
          animation: starTwinkle 2.5s ease-in-out infinite 1.2s;
        }
        .animate-button-neon {
          animation: buttonNeonGlow 3s ease-in-out infinite;
        }
      `}</style>

      {/* Outer Card Glow Wrapper */}
      <div className="relative">
        {/* Pulsing Neon Ambient Glow Background */}
        <div className="absolute -inset-2.5 bg-gradient-to-b from-[#FF8A00]/30 via-[#FF5500]/15 to-transparent rounded-[3rem] blur-2xl animate-neon-glow pointer-events-none" />

        {/* Main Card Container */}
        <div className="relative bg-[#070709] border border-[#2B1E12] rounded-[2.2rem] sm:rounded-[2.8rem] p-5 sm:p-9 md:p-12 text-center shadow-[0_30px_100px_rgba(0,0,0,0.98)] overflow-hidden flex flex-col items-center">
          
          {/* Background Ambient Orange Radial Spotlight */}
          <div className="absolute -top-36 left-1/2 -translate-x-1/2 w-[550px] sm:w-[750px] h-[450px] bg-gradient-to-b from-[#FF8A00]/30 via-[#FF5500]/12 to-transparent rounded-full blur-[130px] pointer-events-none animate-neon-glow" />

          {/* TOP BRAND HEADER LOGO */}
          <div className="relative z-10 flex flex-col items-center justify-center gap-1 mb-6 sm:mb-8">
            <div className="flex items-center justify-center gap-2.5">
              <RifaMasterHookLogo className="w-10 h-10 sm:w-12 sm:h-12 drop-shadow-[0_0_20px_rgba(255,138,0,0.75)]" idPrefix="headerHook" />
              <span className="font-montserrat font-black text-2xl sm:text-3xl md:text-4xl text-white tracking-tight">
                Rifa<span className="bg-gradient-to-r from-[#FF9200] via-[#FF8A00] to-[#FFC247] bg-clip-text text-transparent">Master</span>
              </span>
            </div>
            <span className="text-[10px] sm:text-xs font-black uppercase tracking-[0.28em] text-[#FFC247] font-montserrat drop-shadow-[0_0_10px_rgba(255,194,71,0.3)]">
              Equipamentos Premium
            </span>
          </div>

          {/* 3D MYSTERY GIFT BOX ILLUSTRATION */}
          <div className="relative z-10 my-1 w-full max-w-[320px] sm:max-w-[400px] aspect-[4/3] flex items-center justify-center">
            {/* Pulsing Backlight Halo */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#FF8A00]/35 via-[#FF6000]/18 to-transparent rounded-full blur-2xl animate-neon-glow pointer-events-none" />

            <svg
              className="w-full h-full drop-shadow-[0_22px_50px_rgba(255,138,0,0.4)]"
              viewBox="0 0 360 270"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                {/* Stage Glow Radial */}
                <radialGradient id="podiumGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#FFF2A3" stopOpacity="0.9" />
                  <stop offset="30%" stopColor="#FFC247" stopOpacity="0.65" />
                  <stop offset="65%" stopColor="#FF8A00" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#FF8A00" stopOpacity="0" />
                </radialGradient>

                {/* Ultra Metallic Question Mark Gradient */}
                <linearGradient id="qMarkMetallic" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFFFFF" />
                  <stop offset="20%" stopColor="#FFF6C2" />
                  <stop offset="45%" stopColor="#FFC247" />
                  <stop offset="75%" stopColor="#FF7A00" />
                  <stop offset="100%" stopColor="#B32B00" />
                </linearGradient>

                {/* Box Front Face */}
                <linearGradient id="boxFrontGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#2A2A33" />
                  <stop offset="50%" stopColor="#1A1A22" />
                  <stop offset="100%" stopColor="#0B0B0E" />
                </linearGradient>

                {/* Box Side Face */}
                <linearGradient id="boxSideGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#1C1C24" />
                  <stop offset="100%" stopColor="#060608" />
                </linearGradient>

                {/* Satin Orange Ribbon */}
                <linearGradient id="ribbonOrange" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFB833" />
                  <stop offset="35%" stopColor="#FF8A00" />
                  <stop offset="80%" stopColor="#E64A00" />
                  <stop offset="100%" stopColor="#991B00" />
                </linearGradient>

                {/* Question Mark Drop Shadow & Glow Filter */}
                <filter id="qGlowEffect" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="11" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* PODIUM STAGE BASE */}
              <g id="podium">
                <ellipse cx="180" cy="230" rx="125" ry="24" fill="#0A0A0E" stroke="#282835" strokeWidth="2" />
                <ellipse cx="180" cy="226" rx="105" ry="18" fill="url(#podiumGlow)" />
                <ellipse cx="180" cy="226" rx="105" ry="18" stroke="#FF9200" strokeWidth="2" fill="none" opacity="0.85" />
              </g>

              {/* LIGHT BEAM COMING FROM INSIDE BOX WITH BREATHING EFFECT */}
              <polygon points="135,170 90,30 270,30 225,170" fill="url(#podiumGlow)" className="animate-beam-breathe" />

              {/* FLOATING 3D QUESTION MARK WITH MOTION & GLOW */}
              <g filter="url(#qGlowEffect)" className="animate-qmark-float">
                <circle cx="180" cy="95" r="45" fill="#FF8A00" opacity="0.35" />
                
                {/* 3D Question Mark path */}
                <path
                  d="M 166 70 C 166 57 174 48 186 48 C 198 48 206 55 206 67 C 206 78 197 85 188 92 C 182 97 178 103 178 111 L 178 116 H 192 L 192 111 C 192 105 196 100 202 95 C 211 87 220 78 220 65 C 220 46 204 34 185 34 C 165 34 150 47 150 70 H 166 Z M 185 125 C 180 125 176 129 176 134 C 176 139 180 143 185 143 C 190 143 194 139 194 134 C 194 129 190 125 185 125 Z"
                  fill="url(#qMarkMetallic)"
                  stroke="#FFFDF0"
                  strokeWidth="1.6"
                />
              </g>

              {/* BLACK GIFT BOX BODY - FRONT FACE */}
              <path d="M 110 165 L 180 195 L 180 238 L 110 208 Z" fill="url(#boxFrontGrad)" stroke="#424252" strokeWidth="1.2" />

              {/* BLACK GIFT BOX BODY - RIGHT FACE */}
              <path d="M 180 195 L 250 165 L 250 208 L 180 238 Z" fill="url(#boxSideGrad)" stroke="#424252" strokeWidth="1.2" />

              {/* ORANGE RIBBON STRAPS */}
              {/* Front Vertical Ribbon */}
              <path d="M 140 178 L 150 182 L 150 225 L 140 221 Z" fill="url(#ribbonOrange)" />
              {/* Side Vertical Ribbon */}
              <path d="M 210 182 L 220 178 L 220 221 L 210 225 Z" fill="url(#ribbonOrange)" />

              {/* OPEN BOX LID (TILTED TO THE RIGHT) */}
              <g transform="translate(25, -15) rotate(24 220 145)">
                <path d="M 190 135 L 260 118 L 245 106 L 175 123 Z" fill="#282833" stroke="#FF9200" strokeWidth="1.5" />
                <path d="M 190 135 L 260 118 L 260 128 L 190 145 Z" fill="#14141A" stroke="#3D3D4D" strokeWidth="1" />
                {/* Ribbon Bow on Lid */}
                <path d="M 210 115 C 200 100 222 92 216 115 C 210 92 232 100 222 115 Z" fill="url(#ribbonOrange)" />
              </g>

              {/* TWINKLING STAR PARTICLES */}
              <circle cx="130" cy="70" r="3.2" fill="#FFE082" className="animate-star-1" />
              <circle cx="230" cy="65" r="3.8" fill="#FFFDF0" className="animate-star-2" />
              <circle cx="145" cy="120" r="2.2" fill="#FF8A00" className="animate-star-3" />
              <circle cx="215" cy="105" r="2.8" fill="#FFC247" className="animate-star-1" />
              <circle cx="255" cy="140" r="2.2" fill="#FFF8D1" className="animate-star-2" />
            </svg>
          </div>

          {/* BADGE SUPERIOR COM EFEITO NEON PISCANTE */}
          <div className="relative z-10 inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-[#FF8A00]/60 bg-[#1A0E04]/95 text-[#FFC247] text-xs sm:text-sm font-black uppercase tracking-[0.2em] shadow-[0_0_25px_rgba(255,138,0,0.4)] mb-6 font-montserrat whitespace-nowrap animate-pulse">
            <Megaphone className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-[#FF8A00] shrink-0" />
            <span>PRÉ-LANÇAMENTO</span>
          </div>

          {/* TÍTULO PRINCIPAL COM RICH DEGRADÊ LARANJA PREMIUM */}
          <h2 className="relative z-10 text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-[1.18] mb-4 sm:mb-5 max-w-2xl font-montserrat uppercase">
            ESTAMOS PREPARANDO A <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-[#FF6B00] via-[#FF9200] via-[#FFA800] to-[#FFD054] bg-clip-text text-transparent drop-shadow-[0_4px_25px_rgba(255,138,0,0.45)]">
              PRÓXIMA RIFA
            </span>
          </h2>

          {/* TEXTO DE APOIO */}
          <div className="relative z-10 max-w-xl mx-auto space-y-2 mb-8 sm:mb-10 text-center px-2">
            <p className="text-zinc-200 text-sm sm:text-base md:text-lg font-medium leading-relaxed">
              Em breve uma nova oportunidade para você participar e concorrer a prêmios incríveis.
            </p>
            <p className="text-zinc-400 text-xs sm:text-sm font-normal leading-relaxed">
              Entre no nosso grupo oficial e seja avisado em primeira mão quando a próxima rifa for liberada.
            </p>
          </div>

          {/* DESTAQUES (GLASSMORPHIC CONTAINER WITH 3 COLUMNS) */}
          <div className="relative z-10 w-full mb-8 sm:mb-10 bg-[#111116]/90 border border-[#2B2B38] rounded-2xl p-4 sm:p-5 backdrop-blur-md shadow-[0_15px_35px_rgba(0,0,0,0.65)] hover:border-[#FF8A00]/40 transition-all duration-300">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-2 md:divide-x md:divide-[#2B2B38]">
              
              {/* Feature 1 */}
              <div className="flex items-center gap-3.5 px-2 py-1 md:justify-center">
                <div className="w-10 h-10 rounded-xl bg-[#FF8A00]/20 border border-[#FF8A00]/40 flex items-center justify-center shrink-0 text-[#FF8A00] shadow-[0_0_12px_rgba(255,138,0,0.25)]">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="flex flex-col text-left">
                  <h4 className="text-xs sm:text-sm font-extrabold text-white uppercase tracking-wider font-montserrat whitespace-nowrap">
                    Rifas confiáveis
                  </h4>
                  <p className="text-[11px] sm:text-xs text-zinc-400 font-medium leading-tight">
                    Transparência do início ao sorteio.
                  </p>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="flex items-center gap-3.5 px-2 py-1 md:justify-center">
                <div className="w-10 h-10 rounded-xl bg-[#FF8A00]/20 border border-[#FF8A00]/40 flex items-center justify-center shrink-0 text-[#FF8A00] shadow-[0_0_12px_rgba(255,138,0,0.25)]">
                  <Zap className="w-5 h-5" />
                </div>
                <div className="flex flex-col text-left">
                  <h4 className="text-xs sm:text-sm font-extrabold text-white uppercase tracking-wider font-montserrat whitespace-nowrap">
                    Sistema automatizado
                  </h4>
                  <p className="text-[11px] sm:text-xs text-zinc-400 font-medium leading-tight">
                    Compra, reserva e confirmação.
                  </p>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="flex items-center gap-3.5 px-2 py-1 md:justify-center">
                <div className="w-10 h-10 rounded-xl bg-[#FF8A00]/20 border border-[#FF8A00]/40 flex items-center justify-center shrink-0 text-[#FF8A00] shadow-[0_0_12px_rgba(255,138,0,0.25)]">
                  <Trophy className="w-5 h-5" />
                </div>
                <div className="flex flex-col text-left">
                  <h4 className="text-xs sm:text-sm font-extrabold text-white uppercase tracking-wider font-montserrat whitespace-nowrap">
                    Sorteio ao vivo
                  </h4>
                  <p className="text-[11px] sm:text-xs text-zinc-400 font-medium leading-tight">
                    Acompanhe tudo em tempo real.
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* BOTÃO PRINCIPAL (WHATSAPP CTA WITH NEON GLOW PULSE AND RICH DEGRADÊ) */}
          <div className="relative z-10 w-full mb-6">
            <a
              href={targetGroupUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative inline-flex items-center justify-center gap-3 bg-gradient-to-r from-[#FF6B00] via-[#FF8A00] via-[#FFA000] to-[#FFC247] hover:from-[#ff7914] hover:to-[#ffcc5e] text-[#070709] font-black uppercase tracking-widest text-base sm:text-lg py-4 sm:py-4.5 px-8 rounded-2xl w-full animate-button-neon active:scale-[0.98] transition-all duration-300 cursor-pointer text-center font-montserrat overflow-hidden"
            >
              {/* Highlight sweep */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/35 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />

              <svg
                className="w-6.5 h-6.5 fill-[#070709] shrink-0"
                viewBox="0 0 24 24"
              >
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.457L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.864-9.858.002-2.634-1.013-5.11-2.861-6.958C16.63 1.942 14.161.921 11.533.92 6.1.92 1.681 5.338 1.677 10.776c-.001 1.733.453 3.42 1.314 4.908l-.946 3.454 3.541-.928c1.503.82 3.197 1.253 4.921 1.254zm11.365-7.793c-.26-.13-1.534-.758-1.772-.844-.237-.087-.41-.13-.58.13-.17.26-.66.844-.81 1.016-.15.17-.3.19-.56.06-.26-.13-1.1-.407-2.096-1.295-.774-.69-1.296-1.543-1.448-1.802-.15-.26-.016-.4.118-.532.12-.12.26-.3.39-.45.13-.15.17-.26.26-.43.09-.17.04-.3-.02-.43-.06-.13-.58-1.393-.795-1.912-.21-.51-.43-.44-.58-.45l-.49-.01c-.17 0-.45.06-.69.32-.24.26-.91.89-.91 2.17s.93 2.51 1.06 2.68c.13.17 1.83 2.79 4.43 3.92.62.27 1.11.43 1.49.55.62.2 1.18.17 1.63.1.5-.07 1.53-.62 1.74-1.23.2-.61.2-.13.14-.24-.06-.11-.23-.17-.49-.3z" />
              </svg>
              <span className="whitespace-nowrap">ENTRAR NO GRUPO</span>
            </a>
          </div>

          {/* RODAPÉ DO CARD */}
          <div className="relative z-10 flex items-center justify-center gap-2 text-[#FFC247] text-xs sm:text-sm font-semibold max-w-lg mx-auto text-center font-sans">
            <Lock className="w-4 h-4 text-[#FF8A00] shrink-0" />
            <span>
              Participe do nosso grupo oficial e seja avisado em primeira mão quando a próxima rifa for liberada.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
