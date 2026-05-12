import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
  AbsoluteFill,
  Sequence,
} from "remotion";

// ── Palette ──────────────────────────────────────────────────────────────────
const NAVY = "#0a0f1e";
const BLUE = "#1e3a8a";
const ACCENT = "#3b82f6";
const ACCENT_LIGHT = "#60a5fa";
const WHITE = "#ffffff";
const SURFACE = "#111827";
const BORDER = "rgba(255,255,255,0.08)";
const TEXT_DIM = "rgba(255,255,255,0.45)";
const TEXT_DIMMER = "rgba(255,255,255,0.25)";

// ── Duration map (frames at 60fps) ───────────────────────────────────────────
// Total: 30s = 1800 frames
// Scene transitions: 0.5s = 30 frames
const SCENES = [
  { label: "login",      start: 0,    duration: 300 },  // 0–5s
  { label: "dashboard",  start: 300,  duration: 300 },  // 5–10s
  { label: "booking1",   start: 600,  duration: 240 },  // 10–14s
  { label: "booking2",   start: 840,  duration: 240 },  // 14–18s
  { label: "booking3",   start: 1080, duration: 240 },  // 18–22s
  { label: "bookings",   start: 1320, duration: 240 },  // 22–26s
  { label: "payments",   start: 1560, duration: 240 },  // 26–30s
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const useSpringIn = (frame: number, delay = 0, config = { damping: 18, mass: 0.6 }) =>
  spring({ frame: frame - delay, fps: 60, config: { stiffness: 120, ...config } });

const fade = (frame: number, delay = 0, dur = 30) =>
  interpolate(frame - delay, [0, dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

const slideUp = (frame: number, delay = 0, dist = 40) => {
  const p = interpolate(frame - delay, [0, 35], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  return dist * (1 - p);
};

// ── VS Media Logo (SVG inline) ────────────────────────────────────────────────
const Logo: React.FC<{ size?: number; opacity?: number }> = ({ size = 120, opacity = 1 }) => (
  <svg
    style={{ opacity }}
    width={size}
    height={size * (68.49 / 476.51)}
    viewBox="0 0 476.51 68.49"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g>
      <path fill={WHITE} d="M24.95,67.3L0,.99h19.38l16.4,47.82L52.09.99h19.38l-24.95,66.31h-21.57Z"/>
      <path fill={WHITE} d="M71.57,57.96l9.05-13.32c4.77,4.77,12.13,8.75,21.27,8.75,5.77,0,9.34-1.99,9.34-5.27,0-8.75-37.48-1.49-37.48-27.04,0-11.13,9.34-21.07,26.34-21.07,10.64,0,19.88,3.18,26.94,9.24l-9.34,12.83c-5.57-4.67-12.82-6.96-19.38-6.96-4.97,0-7.16,1.69-7.16,4.57,0,8.15,37.48,1.99,37.48,26.64,0,13.32-9.84,22.17-27.64,22.17-13.42,0-22.76-4.27-29.42-10.54Z"/>
      <path fill={WHITE} d="M137.62,67.3v-12.65s17.1-6.5,17.1-6.5v19.15h-17.1Z"/>
    </g>
    <g>
      <path fill={WHITE} d="M176.88.99l24.26,48.14L225.31.99h9.29v66.34h-7.01l-.1-55.15-24.16,48.14h-4.55l-24.07-48.14v55.15h-7.2V.99h9.38Z"/>
      <path fill={WHITE} d="M299.79.99v7.01h-37.43v22.27h33.45v6.92h-33.45v23.12h38.66v7.01h-46.24V.99h45.01Z"/>
      <path fill={WHITE} d="M377.4,34.16c0,18.86-14.88,33.17-34.4,33.17h-26.53V.99h26.82c19.33,0,34.12,14.31,34.12,33.17ZM369.72,34.26c0-14.97-11.75-26.25-26.63-26.25h-19.05v52.31h19.33c14.78,0,26.34-11.18,26.34-26.06Z"/>
      <path fill={WHITE} d="M398.81.99v66.34h-7.58V.99h7.58Z"/>
      <path fill={WHITE} d="M460.78,50.37h-36.1l-7.39,16.96h-8.05L438.98.99h7.87l29.66,66.34h-8.24l-7.49-16.96ZM457.75,43.35l-15.07-34.12-14.88,34.12h29.95Z"/>
    </g>
  </svg>
);

// ── Phone chrome ──────────────────────────────────────────────────────────────
const PHONE_W = 780;
const PHONE_H = 1590;
const SCREEN_W = 710;
const SCREEN_H = 1460;
const SCREEN_X = (PHONE_W - SCREEN_W) / 2;
const SCREEN_Y = 60;
const RADIUS = 60;

const IPhoneFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <g>
    {/* Body */}
    <rect x={0} y={0} width={PHONE_W} height={PHONE_H} rx={80} ry={80}
      fill="#1a1a1e" />
    {/* Side highlight */}
    <rect x={2} y={2} width={PHONE_W - 4} height={PHONE_H - 4} rx={79} ry={79}
      fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={2} />
    {/* Dynamic Island */}
    <rect x={(PHONE_W - 180) / 2} y={22} width={180} height={34} rx={17}
      fill="#000" />
    {/* Screen clip region is handled by the foreignObject below */}
    <rect x={SCREEN_X} y={SCREEN_Y} width={SCREEN_W} height={SCREEN_H}
      rx={RADIUS} ry={RADIUS} fill={NAVY} />
    {/* Screen content */}
    <foreignObject x={SCREEN_X} y={SCREEN_Y} width={SCREEN_W} height={SCREEN_H}>
      <div
        style={{
          width: SCREEN_W,
          height: SCREEN_H,
          borderRadius: RADIUS,
          overflow: "hidden",
          background: NAVY,
          fontFamily: "'Montserrat', 'Inter', system-ui, sans-serif",
          WebkitFontSmoothing: "antialiased",
          position: "relative",
        }}
      >
        {children}
      </div>
    </foreignObject>
    {/* Bottom bar */}
    <rect x={(PHONE_W - 120) / 2} y={PHONE_H - 28} width={120} height={5} rx={3}
      fill="rgba(255,255,255,0.4)" />
  </g>
);

// ── Status bar ────────────────────────────────────────────────────────────────
const StatusBar: React.FC = () => (
  <div style={{
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "12px 28px 0", height: 44,
    fontSize: 13, fontWeight: 600, color: WHITE,
  }}>
    <span>9:41</span>
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <svg width="17" height="12" viewBox="0 0 17 12" fill="none">
        <rect x="0" y="4" width="3" height="8" rx="1" fill="rgba(255,255,255,0.4)"/>
        <rect x="4.5" y="2.5" width="3" height="9.5" rx="1" fill="rgba(255,255,255,0.6)"/>
        <rect x="9" y="0.5" width="3" height="11.5" rx="1" fill={WHITE}/>
        <rect x="13.5" y="0" width="3.5" height="12" rx="1" fill={WHITE}/>
      </svg>
      <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
        <path d="M8 2.5C10.2 2.5 12.1 3.5 13.4 5L15 3.4C13.3 1.7 10.8 0.5 8 0.5C5.2 0.5 2.7 1.7 1 3.4L2.6 5C3.9 3.5 5.8 2.5 8 2.5Z" fill={WHITE}/>
        <path d="M8 5.5C9.4 5.5 10.7 6.1 11.6 7.1L13.2 5.5C11.9 4.2 10.1 3.5 8 3.5C5.9 3.5 4.1 4.2 2.8 5.5L4.4 7.1C5.3 6.1 6.6 5.5 8 5.5Z" fill={WHITE}/>
        <circle cx="8" cy="10" r="1.5" fill={WHITE}/>
      </svg>
      <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
        <div style={{ width: 22, height: 11, border: "1.5px solid rgba(255,255,255,0.5)", borderRadius: 3, padding: "1.5px 2px", display: "flex", alignItems: "center" }}>
          <div style={{ width: 14, height: 6, background: "#4ade80", borderRadius: 1.5 }} />
        </div>
      </div>
    </div>
  </div>
);

// ── Nav bar ───────────────────────────────────────────────────────────────────
const NavBar: React.FC<{ title: string }> = ({ title }) => (
  <div style={{
    padding: "10px 24px 14px",
    borderBottom: `1px solid ${BORDER}`,
    background: "rgba(10,15,30,0.95)",
    backdropFilter: "blur(12px)",
  }}>
    <div style={{ fontSize: 17, fontWeight: 700, color: WHITE, letterSpacing: -0.3 }}>
      {title}
    </div>
  </div>
);

// ── Scene: Login ──────────────────────────────────────────────────────────────
const SceneLogin: React.FC<{ frame: number }> = ({ frame }) => {
  const logoScale = useSpringIn(frame, 10);
  const logoY = slideUp(frame, 10);
  const ctaOpacity = fade(frame, 50);
  const ctaY = slideUp(frame, 50);
  const tagOpacity = fade(frame, 80);

  return (
    <div style={{
      width: "100%", height: "100%", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", background: NAVY, gap: 0,
    }}>
      <div style={{
        transform: `scale(${logoScale}) translateY(${logoY}px)`,
        display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 48,
      }}>
        <Logo size={200} />
        <div style={{
          marginTop: 10, fontSize: 13, fontWeight: 300, letterSpacing: "0.28em",
          textTransform: "uppercase", color: "rgba(255,255,255,0.3)",
        }}>
          Calendar
        </div>
      </div>

      <div style={{
        opacity: ctaOpacity,
        transform: `translateY(${ctaY}px)`,
        display: "flex", alignItems: "center", gap: 12,
        background: WHITE, borderRadius: 14, padding: "16px 28px",
        cursor: "pointer",
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        <span style={{ fontSize: 16, fontWeight: 600, color: "#1a1a1a", letterSpacing: -0.2 }}>
          Entrar com Google
        </span>
      </div>

      <div style={{
        marginTop: 28, opacity: tagOpacity * 0.45,
        fontSize: 13, color: WHITE, letterSpacing: "0.04em",
      }}>
        calendar.vsmedia.pt
      </div>
    </div>
  );
};

// ── Scene: Dashboard ──────────────────────────────────────────────────────────
const SceneDashboard: React.FC<{ frame: number }> = ({ frame }) => {
  const cards = [
    { label: "Este mês", value: "4", sub: "marcações", color: ACCENT, delay: 20 },
    { label: "Ganhos", value: "600 €", sub: "flat fee", color: "#4ade80", delay: 35 },
    { label: "Pendentes", value: "1", sub: "a confirmar", color: "#fbbf24", delay: 50 },
  ];

  const bookings = [
    { title: "Vídeo + Drone", addr: "Av. Liberdade 45, Lisboa", date: "2 Jun · 10:00", status: "Confirmado", statusColor: ACCENT },
    { title: "Fotografia T3/T4", addr: "R. Augusta 12, Lisboa", date: "5 Jun · 14:30", status: "Pendente", statusColor: "#fbbf24" },
    { title: "Vídeo Standard", addr: "Chiado, Lisboa", date: "8 Jun · 09:00", status: "Pendente", statusColor: "#fbbf24" },
  ];

  return (
    <div style={{ width: "100%", height: "100%", background: NAVY, display: "flex", flexDirection: "column" }}>
      <StatusBar />
      <NavBar title="Dashboard" />
      <div style={{ flex: 1, overflowY: "hidden", padding: "20px 20px" }}>

        {/* Avatar + greeting */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, opacity: fade(frame, 5) }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: ACCENT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: WHITE }}>J</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: WHITE }}>Olá, João</div>
            <div style={{ fontSize: 12, color: TEXT_DIM }}>Consultor</div>
          </div>
        </div>

        {/* Stat cards */}
        <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
          {cards.map((c, i) => (
            <div key={i} style={{
              flex: 1, background: SURFACE, border: `1px solid ${BORDER}`,
              borderRadius: 14, padding: "14px 12px",
              opacity: fade(frame, c.delay),
              transform: `translateY(${slideUp(frame, c.delay)}px)`,
            }}>
              <div style={{ fontSize: 11, color: TEXT_DIM, marginBottom: 4, fontWeight: 500 }}>{c.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: c.color, letterSpacing: -0.5 }}>{c.value}</div>
              <div style={{ fontSize: 11, color: TEXT_DIMMER, marginTop: 2 }}>{c.sub}</div>
            </div>
          ))}
        </div>

        {/* Upcoming */}
        <div style={{ fontSize: 13, fontWeight: 700, color: TEXT_DIM, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12, opacity: fade(frame, 60) }}>
          Próximas marcações
        </div>
        {bookings.map((b, i) => (
          <div key={i} style={{
            background: SURFACE, border: `1px solid ${BORDER}`,
            borderRadius: 14, padding: "14px 16px", marginBottom: 10,
            opacity: fade(frame, 70 + i * 15),
            transform: `translateY(${slideUp(frame, 70 + i * 15)}px)`,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: WHITE, marginBottom: 4 }}>{b.title}</div>
              <span style={{
                fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 999,
                background: `${b.statusColor}22`, color: b.statusColor, border: `1px solid ${b.statusColor}44`,
              }}>{b.status}</span>
            </div>
            <div style={{ fontSize: 12, color: TEXT_DIM }}>{b.addr}</div>
            <div style={{ fontSize: 11, color: TEXT_DIMMER, marginTop: 4 }}>{b.date}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Scene: Booking step 1 – Videographer ──────────────────────────────────────
const SceneBooking1: React.FC<{ frame: number }> = ({ frame }) => {
  const videographers = [
    { name: "Tiago Palmeida", spec: "Vídeo · Drone · Foto", selected: true },
    { name: "Ricardo Ferreira", spec: "Vídeo · AI", selected: false },
  ];

  return (
    <div style={{ width: "100%", height: "100%", background: NAVY, display: "flex", flexDirection: "column" }}>
      <StatusBar />
      <NavBar title="Nova Marcação" />
      {/* Steps */}
      <div style={{ display: "flex", padding: "14px 20px 10px", gap: 6, opacity: fade(frame, 5) }}>
        {["Videógrafo", "Serviços", "Data", "Imóvel", "Confirmar"].map((s, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{
              width: 24, height: 24, borderRadius: "50%", fontSize: 11, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: i === 0 ? ACCENT : "rgba(255,255,255,0.08)",
              color: i === 0 ? WHITE : TEXT_DIMMER,
              border: i === 0 ? "none" : `1px solid rgba(255,255,255,0.1)`,
            }}>{i + 1}</div>
            <div style={{ fontSize: 9, color: i === 0 ? ACCENT_LIGHT : TEXT_DIMMER, textAlign: "center" }}>{s}</div>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, padding: "0 20px", overflowY: "hidden" }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: TEXT_DIM, marginBottom: 14, opacity: fade(frame, 15) }}>
          Escolhe o videógrafo
        </div>
        {videographers.map((v, i) => (
          <div key={i} style={{
            background: v.selected ? `${ACCENT}18` : SURFACE,
            border: `1px solid ${v.selected ? ACCENT + "55" : BORDER}`,
            borderRadius: 16, padding: "18px 16px", marginBottom: 12,
            opacity: fade(frame, 20 + i * 15),
            transform: `translateY(${slideUp(frame, 20 + i * 15)}px)`,
            display: "flex", alignItems: "center", gap: 14,
          }}>
            <div style={{
              width: 46, height: 46, borderRadius: "50%",
              background: v.selected ? ACCENT : "rgba(255,255,255,0.08)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, fontWeight: 700, color: WHITE, flexShrink: 0,
            }}>{v.name[0]}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: WHITE }}>{v.name}</div>
              <div style={{ fontSize: 12, color: TEXT_DIM, marginTop: 3 }}>{v.spec}</div>
            </div>
            {v.selected && (
              <div style={{ width: 22, height: 22, borderRadius: "50%", background: ACCENT, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke={WHITE} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            )}
          </div>
        ))}
        {/* CTA */}
        <div style={{
          marginTop: 16, background: ACCENT, borderRadius: 14, padding: "16px",
          textAlign: "center", fontSize: 15, fontWeight: 700, color: WHITE,
          opacity: fade(frame, 60),
        }}>
          Continuar
        </div>
      </div>
    </div>
  );
};

// ── Scene: Booking step 2 – Services ─────────────────────────────────────────
const SceneBooking2: React.FC<{ frame: number }> = ({ frame }) => {
  const services = [
    { label: "Vídeo Standard", price: "150 €", selected: true, icon: "🎬" },
    { label: "Vídeo + Drone", price: "180 €", selected: false, icon: "🚁" },
    { label: "Fotografia T3/T4", price: "55 €", selected: false, icon: "📷" },
    { label: "Taxa IA", price: "25 €", selected: true, icon: "✨" },
  ];

  return (
    <div style={{ width: "100%", height: "100%", background: NAVY, display: "flex", flexDirection: "column" }}>
      <StatusBar />
      <NavBar title="Nova Marcação" />
      <div style={{ display: "flex", padding: "14px 20px 10px", gap: 6, opacity: fade(frame, 5) }}>
        {["Videógrafo", "Serviços", "Data", "Imóvel", "Confirmar"].map((s, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{
              width: 24, height: 24, borderRadius: "50%", fontSize: 11, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: i <= 1 ? ACCENT : "rgba(255,255,255,0.08)",
              color: i <= 1 ? WHITE : TEXT_DIMMER,
            }}>{i + 1}</div>
            <div style={{ fontSize: 9, color: i === 1 ? ACCENT_LIGHT : TEXT_DIMMER, textAlign: "center" }}>{s}</div>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, padding: "0 20px", overflowY: "hidden" }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: TEXT_DIM, marginBottom: 14, opacity: fade(frame, 10) }}>
          Selecciona os serviços
        </div>
        {services.map((s, i) => (
          <div key={i} style={{
            background: s.selected ? `${ACCENT}18` : SURFACE,
            border: `1px solid ${s.selected ? ACCENT + "55" : BORDER}`,
            borderRadius: 14, padding: "14px 16px", marginBottom: 10,
            display: "flex", alignItems: "center", gap: 14,
            opacity: fade(frame, 15 + i * 12),
            transform: `translateY(${slideUp(frame, 15 + i * 12)}px)`,
          }}>
            <div style={{ fontSize: 22 }}>{s.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: WHITE }}>{s.label}</div>
              <div style={{ fontSize: 12, color: ACCENT_LIGHT, marginTop: 2 }}>{s.price} + IVA</div>
            </div>
            <div style={{
              width: 22, height: 22, borderRadius: 6,
              background: s.selected ? ACCENT : "rgba(255,255,255,0.08)",
              border: s.selected ? "none" : "1px solid rgba(255,255,255,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {s.selected && <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke={WHITE} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
              </svg>}
            </div>
          </div>
        ))}

        {/* Total */}
        <div style={{
          background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14,
          padding: "14px 16px", marginTop: 6, display: "flex", justifyContent: "space-between",
          opacity: fade(frame, 70),
        }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: TEXT_DIM }}>Total (sem IVA)</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: WHITE }}>175 €</span>
        </div>

        <div style={{
          marginTop: 12, background: ACCENT, borderRadius: 14, padding: "16px",
          textAlign: "center", fontSize: 15, fontWeight: 700, color: WHITE,
          opacity: fade(frame, 80),
        }}>
          Continuar
        </div>
      </div>
    </div>
  );
};

// ── Scene: Booking step 3 – Confirm ──────────────────────────────────────────
const SceneBooking3: React.FC<{ frame: number }> = ({ frame }) => {
  const rows = [
    { label: "Videógrafo", value: "Tiago Palmeida" },
    { label: "Serviços", value: "Vídeo Standard + Taxa IA" },
    { label: "Data", value: "2 de Junho · 10:00" },
    { label: "Imóvel", value: "Av. da Liberdade 45, Lisboa" },
    { label: "Pagamento", value: "Flat Fee" },
    { label: "Total", value: "175 € + IVA" },
  ];

  return (
    <div style={{ width: "100%", height: "100%", background: NAVY, display: "flex", flexDirection: "column" }}>
      <StatusBar />
      <NavBar title="Nova Marcação" />
      <div style={{ display: "flex", padding: "14px 20px 10px", gap: 6, opacity: fade(frame, 5) }}>
        {["Videógrafo", "Serviços", "Data", "Imóvel", "Confirmar"].map((s, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{
              width: 24, height: 24, borderRadius: "50%", fontSize: 11, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: ACCENT, color: WHITE,
            }}>{i + 1}</div>
            <div style={{ fontSize: 9, color: i === 4 ? ACCENT_LIGHT : TEXT_DIMMER, textAlign: "center" }}>{s}</div>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, padding: "0 20px", overflowY: "hidden" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: WHITE, marginBottom: 14, opacity: fade(frame, 10) }}>
          Resumo da marcação
        </div>
        <div style={{
          background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16,
          overflow: "hidden", opacity: fade(frame, 15),
        }}>
          {rows.map((r, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", padding: "13px 16px",
              borderBottom: i < rows.length - 1 ? `1px solid ${BORDER}` : "none",
              transform: `translateY(${slideUp(frame, 15 + i * 10)}px)`,
              opacity: fade(frame, 15 + i * 10),
            }}>
              <span style={{ fontSize: 13, color: TEXT_DIM }}>{r.label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: i === rows.length - 1 ? ACCENT_LIGHT : WHITE }}>{r.value}</span>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: 20,
          background: ACCENT, borderRadius: 14, padding: "17px",
          textAlign: "center", fontSize: 15, fontWeight: 700, color: WHITE,
          opacity: fade(frame, 80),
          boxShadow: `0 8px 24px ${ACCENT}44`,
        }}>
          Confirmar Marcação
        </div>
      </div>
    </div>
  );
};

// ── Scene: My Bookings ────────────────────────────────────────────────────────
const SceneBookings: React.FC<{ frame: number }> = ({ frame }) => {
  const bookings = [
    { title: "Vídeo + Drone", addr: "Av. Liberdade 45", date: "2 Jun · 10:00", status: "Confirmado", color: ACCENT },
    { title: "Fotografia T3/T4", addr: "R. Augusta 12", date: "5 Jun · 14:30", status: "Pendente", color: "#fbbf24" },
    { title: "Vídeo Standard", addr: "Chiado, Lisboa", date: "8 Jun · 09:00", status: "Concluído", color: "#4ade80" },
  ];

  return (
    <div style={{ width: "100%", height: "100%", background: NAVY, display: "flex", flexDirection: "column" }}>
      <StatusBar />
      <NavBar title="As minhas marcações" />
      <div style={{ flex: 1, padding: "16px 20px", overflowY: "hidden" }}>
        {bookings.map((b, i) => (
          <div key={i} style={{
            background: SURFACE, border: `1px solid ${BORDER}`,
            borderRadius: 16, padding: "16px", marginBottom: 12,
            opacity: fade(frame, 10 + i * 20),
            transform: `translateY(${slideUp(frame, 10 + i * 20)}px)`,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: WHITE }}>{b.title}</div>
              <span style={{
                fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 999,
                background: `${b.color}22`, color: b.color, border: `1px solid ${b.color}44`,
              }}>{b.status}</span>
            </div>
            <div style={{ fontSize: 12, color: TEXT_DIM, marginBottom: 4 }}>{b.addr}</div>
            <div style={{ fontSize: 11, color: TEXT_DIMMER }}>{b.date}</div>
            {b.status === "Concluído" && (
              <div style={{
                marginTop: 10, padding: "8px 14px", background: `${ACCENT}18`,
                border: `1px solid ${ACCENT}44`, borderRadius: 10,
                fontSize: 12, fontWeight: 600, color: ACCENT_LIGHT,
                display: "inline-flex", alignItems: "center", gap: 6,
              }}>
                <span>↓</span> Download conteúdos
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Scene: Payments ───────────────────────────────────────────────────────────
const ScenePayments: React.FC<{ frame: number }> = ({ frame }) => {
  const months = [
    { month: "Abril 2026", amount: "215,25 €", status: "Pago", color: "#4ade80", paid: true },
    { month: "Maio 2026", amount: "430,50 €", status: "Pago", color: "#4ade80", paid: true },
    { month: "Junho 2026", amount: "175,00 €", status: "Pendente", color: "#fbbf24", paid: false },
  ];

  return (
    <div style={{ width: "100%", height: "100%", background: NAVY, display: "flex", flexDirection: "column" }}>
      <StatusBar />
      <NavBar title="Pagamentos" />
      <div style={{ flex: 1, padding: "16px 20px", overflowY: "hidden" }}>

        {/* Balance card */}
        <div style={{
          background: `linear-gradient(135deg, ${BLUE}, ${ACCENT}88)`,
          borderRadius: 20, padding: "22px 20px", marginBottom: 20,
          border: `1px solid ${ACCENT}44`,
          opacity: fade(frame, 8),
          transform: `translateY(${slideUp(frame, 8)}px)`,
        }}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginBottom: 6, fontWeight: 500 }}>Total em dívida</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: WHITE, letterSpacing: -1 }}>175,00 €</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>Junho 2026 · vence dia 30</div>
        </div>

        <div style={{ fontSize: 12, fontWeight: 700, color: TEXT_DIM, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12, opacity: fade(frame, 30) }}>
          Histórico
        </div>

        {months.map((m, i) => (
          <div key={i} style={{
            background: SURFACE, border: `1px solid ${BORDER}`,
            borderRadius: 14, padding: "14px 16px", marginBottom: 10,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            opacity: fade(frame, 35 + i * 18),
            transform: `translateY(${slideUp(frame, 35 + i * 18)}px)`,
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: WHITE }}>{m.month}</div>
              <div style={{ fontSize: 12, color: TEXT_DIM, marginTop: 2 }}>{m.amount}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{
                fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 999,
                background: `${m.color}22`, color: m.color, border: `1px solid ${m.color}44`,
              }}>{m.status}</span>
              {!m.paid && (
                <div style={{
                  background: ACCENT, borderRadius: 8, padding: "6px 12px",
                  fontSize: 11, fontWeight: 700, color: WHITE,
                }}>Pagar</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Transition wipe ───────────────────────────────────────────────────────────
const SceneTransition: React.FC<{ frame: number; total: number }> = ({ frame, total }) => {
  const p = interpolate(frame, [0, total], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{
      position: "absolute", inset: 0, pointerEvents: "none",
      background: `linear-gradient(to bottom, ${NAVY}, ${BLUE})`,
      opacity: interpolate(Math.abs(p - 0.5), [0, 0.5], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    }} />
  );
};

// ── Main composition ──────────────────────────────────────────────────────────
export const IPhoneDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const TRANS = 30; // transition frames

  const scale = Math.min(width / (PHONE_W + 80), height / (PHONE_H + 80));
  const bgPulse = interpolate(Math.sin(frame * 0.015), [-1, 1], [0.95, 1.05]);

  return (
    <AbsoluteFill style={{
      background: `radial-gradient(ellipse at 40% 60%, ${BLUE}55 0%, ${NAVY} 70%)`,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {/* Ambient glow */}
      <div style={{
        position: "absolute",
        width: 600, height: 600,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${ACCENT}18 0%, transparent 70%)`,
        transform: `scale(${bgPulse})`,
        left: "50%", top: "50%",
        marginLeft: -300, marginTop: -300,
        pointerEvents: "none",
      }} />

      <svg
        width={PHONE_W * scale}
        height={PHONE_H * scale}
        viewBox={`0 0 ${PHONE_W} ${PHONE_H}`}
        style={{ filter: "drop-shadow(0 40px 80px rgba(0,0,0,0.8))" }}
      >
        <IPhoneFrame>
          <Sequence from={SCENES[0].start} durationInFrames={SCENES[0].duration}>
            <SceneLogin frame={frame - SCENES[0].start} />
          </Sequence>
          <Sequence from={SCENES[1].start} durationInFrames={SCENES[1].duration}>
            <SceneDashboard frame={frame - SCENES[1].start} />
          </Sequence>
          <Sequence from={SCENES[2].start} durationInFrames={SCENES[2].duration}>
            <SceneBooking1 frame={frame - SCENES[2].start} />
          </Sequence>
          <Sequence from={SCENES[3].start} durationInFrames={SCENES[3].duration}>
            <SceneBooking2 frame={frame - SCENES[3].start} />
          </Sequence>
          <Sequence from={SCENES[4].start} durationInFrames={SCENES[4].duration}>
            <SceneBooking3 frame={frame - SCENES[4].start} />
          </Sequence>
          <Sequence from={SCENES[5].start} durationInFrames={SCENES[5].duration}>
            <SceneBookings frame={frame - SCENES[5].start} />
          </Sequence>
          <Sequence from={SCENES[6].start} durationInFrames={SCENES[6].duration}>
            <ScenePayments frame={frame - SCENES[6].start} />
          </Sequence>
        </IPhoneFrame>
      </svg>
    </AbsoluteFill>
  );
};
