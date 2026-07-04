import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// ── Palette ──────────────────────────────────────────────────────────────────
const NAVY = "#071024";
const NAVY_2 = "#0d1b3a";
const PITCH = "#07301f";
const AQUA = "#22d3ee";
const AQUA_DEEP = "#0891b2";
const AQUA_LIGHT = "#a5f3fc";
const WHITE = "#ffffff";
const GOLD = "#fbbf24";
const TEXT_DIM = "rgba(255,255,255,0.55)";

const TITLE = "HYDRATION BREAK";
const BREAK_SECONDS = 3 * 60; // regulation cooling break: 3 minutes

// ── Small helpers ─────────────────────────────────────────────────────────────
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

const easeOut = (frame: number, delay: number, dur: number) =>
  interpolate(frame - delay, [0, dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

// ── Animated water wave (SVG sine path) ───────────────────────────────────────
const Wave: React.FC<{
  width: number;
  height: number;
  amplitude: number;
  speed: number;
  color: string;
  phase?: number;
}> = ({ width, height, amplitude, speed, color, phase = 0 }) => {
  const frame = useCurrentFrame();
  const t = frame * speed + phase;
  const points: string[] = [];
  const steps = 48;
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * width;
    const y =
      height / 2 +
      Math.sin((i / steps) * Math.PI * 4 + t) * amplitude +
      Math.sin((i / steps) * Math.PI * 7 + t * 1.6) * amplitude * 0.4;
    points.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  const d = `${points.join(" ")} L${width},${height} L0,${height} Z`;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ position: "absolute", bottom: 0, left: 0 }}
    >
      <path d={d} fill={color} />
    </svg>
  );
};

// ── Water droplet icon with falling drop + ripple ─────────────────────────────
const DropIcon: React.FC<{ size: number }> = ({ size }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Gentle bob of the main droplet
  const bob = Math.sin((frame / fps) * Math.PI * 2 * 0.8) * size * 0.03;

  // Looping small drop that falls every ~1.4s
  const loop = 1.4 * fps;
  const p = (frame % loop) / loop;
  const dropY = interpolate(p, [0, 0.55], [-size * 0.1, size * 0.42], {
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.quad),
  });
  const dropOpacity = interpolate(p, [0, 0.05, 0.5, 0.58], [0, 1, 1, 0], {
    extrapolateRight: "clamp",
  });
  const rippleP = interpolate(p, [0.55, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rippleR = size * 0.12 + rippleP * size * 0.22;
  const rippleOpacity = (1 - rippleP) * 0.8;

  const s = size;
  return (
    <svg width={s} height={s} viewBox="0 0 100 100">
      {/* Main droplet */}
      <g transform={`translate(0 ${bob})`}>
        <path
          d="M50 12 C50 12 26 42 26 60 a24 24 0 0 0 48 0 C74 42 50 12 50 12 Z"
          fill="url(#dropGrad)"
        />
        <path
          d="M38 58 a13 15 0 0 0 8 16"
          stroke={AQUA_LIGHT}
          strokeWidth={4.5}
          strokeLinecap="round"
          fill="none"
          opacity={0.9}
        />
      </g>
      {/* Falling mini drop */}
      <circle cx={78} cy={20 + dropY} r={4.5} fill={AQUA_LIGHT} opacity={dropOpacity} />
      {/* Ripple */}
      <ellipse
        cx={78}
        cy={66}
        rx={rippleR}
        ry={rippleR * 0.35}
        stroke={AQUA_LIGHT}
        strokeWidth={2.5}
        fill="none"
        opacity={rippleOpacity}
      />
      <defs>
        <linearGradient id="dropGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={AQUA_LIGHT} />
          <stop offset="55%" stopColor={AQUA} />
          <stop offset="100%" stopColor={AQUA_DEEP} />
        </linearGradient>
      </defs>
    </svg>
  );
};

// ── Stadium backdrop ──────────────────────────────────────────────────────────
const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const drift = Math.sin((frame / fps) * Math.PI * 2 * 0.05) * 40;

  return (
    <AbsoluteFill>
      {/* Night sky → pitch gradient */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, ${NAVY} 0%, ${NAVY_2} 46%, ${PITCH} 100%)`,
        }}
      />
      {/* Floodlight glows */}
      {[0.18, 0.5, 0.82].map((x, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: x * width - 300 + drift * (i - 1),
            top: -140,
            width: 600,
            height: 520,
            background:
              "radial-gradient(ellipse at center, rgba(165,243,252,0.16) 0%, rgba(165,243,252,0) 65%)",
          }}
        />
      ))}
      {/* Pitch stripes */}
      {Array.from({ length: 7 }).map((_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            bottom: 0,
            left: ((i - 1) / 5) * width - 120,
            width: width / 5,
            height: height * 0.4,
            background: i % 2 ? "rgba(255,255,255,0.025)" : "transparent",
            transform: "skewX(-14deg)",
          }}
        />
      ))}
      {/* Heat haze sun badge, top-right */}
      <div
        style={{
          position: "absolute",
          top: 70,
          right: 90,
          width: 130,
          height: 130,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${GOLD} 0%, rgba(251,191,36,0.55) 45%, rgba(251,191,36,0) 72%)`,
          filter: "blur(1px)",
          opacity: 0.9,
        }}
      />
      {/* Vignette */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.5) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

// ── Main composition ──────────────────────────────────────────────────────────
export const HydrationBreak: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width } = useVideoConfig();

  const OUT_START = durationInFrames - 36;

  // Banner entrance / exit
  const enter = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 110, mass: 0.9 },
  });
  const exit = easeOut(frame, OUT_START, 30);
  const bannerY = (1 - enter) * 320 + exit * 380;
  const bannerOpacity = clamp(enter * 2) * (1 - exit);

  // Top chip (match clock) enters slightly later
  const chipIn = easeOut(frame, 18, 24);
  const chipY = (1 - chipIn) * -30;

  // Accent line sweep across the banner on entrance
  const sweep = easeOut(frame, 10, 40);

  // Title letters stagger in
  const letters = TITLE.split("");

  // Periodic shimmer across the title
  const shimmerLoop = 3.2 * fps;
  const shimmerP = ((frame + fps) % shimmerLoop) / shimmerLoop;
  const shimmerX = interpolate(shimmerP, [0, 0.35], [-30, 130], {
    extrapolateRight: "clamp",
  });

  // Countdown: 3:00, starts ticking once the banner has landed
  const tickStart = 1.2 * fps;
  const elapsed = Math.max(0, (frame - tickStart) / fps);
  const remaining = Math.max(0, BREAK_SECONDS - Math.floor(elapsed));
  const mm = Math.floor(remaining / 60);
  const ss = String(remaining % 60).padStart(2, "0");
  const timerPulse = 1 + Math.sin((frame / fps) * Math.PI * 2) * 0.015;
  const timerFrac = remaining / BREAK_SECONDS;

  const BANNER_W = 1360;

  return (
    <AbsoluteFill style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      <Backdrop />

      {/* Lower-third block */}
      <div
        style={{
          position: "absolute",
          bottom: 96,
          left: (width - BANNER_W) / 2,
          width: BANNER_W,
          transform: `translateY(${bannerY}px)`,
          opacity: bannerOpacity,
        }}
      >
        {/* Match-clock chip */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 14,
            marginLeft: 8,
            padding: "10px 22px",
            borderRadius: 10,
            background: "rgba(7,16,36,0.92)",
            border: "1px solid rgba(34,211,238,0.35)",
            transform: `translateY(${chipY}px)`,
            opacity: chipIn,
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: GOLD,
              boxShadow: `0 0 12px ${GOLD}`,
              opacity: 0.5 + 0.5 * Math.abs(Math.sin((frame / fps) * Math.PI * 1.5)),
            }}
          />
          <span style={{ color: WHITE, fontSize: 26, fontWeight: 700, letterSpacing: 2 }}>
            30&#8242; &nbsp;PRIMEIRA PARTE
          </span>
          <span style={{ color: TEXT_DIM, fontSize: 24, fontWeight: 700, letterSpacing: 3 }}>
            JOGO PAUSADO
          </span>
        </div>

        {/* Main banner */}
        <div
          style={{
            position: "relative",
            height: 176,
            borderRadius: 20,
            overflow: "hidden",
            background: `linear-gradient(90deg, rgba(7,16,36,0.97) 0%, rgba(13,27,58,0.97) 60%, rgba(8,145,178,0.28) 100%)`,
            border: "1.5px solid rgba(34,211,238,0.4)",
            boxShadow: "0 24px 70px rgba(0,0,0,0.55), 0 0 60px rgba(34,211,238,0.18)",
            display: "flex",
            alignItems: "center",
          }}
        >
          {/* Waves along the bottom of the banner */}
          <div style={{ position: "absolute", inset: 0, opacity: 0.5 }}>
            <Wave width={BANNER_W} height={54} amplitude={7} speed={0.06} color="rgba(8,145,178,0.5)" />
            <Wave
              width={BANNER_W}
              height={40}
              amplitude={5}
              speed={0.09}
              phase={2.2}
              color="rgba(34,211,238,0.45)"
            />
          </div>

          {/* Entrance light sweep */}
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `${-25 + sweep * 130}%`,
              width: "18%",
              background:
                "linear-gradient(100deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.14) 50%, rgba(255,255,255,0) 100%)",
              transform: "skewX(-18deg)",
            }}
          />

          {/* Icon block */}
          <div
            style={{
              width: 176,
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(160deg, rgba(34,211,238,0.2), rgba(8,145,178,0.08))",
              borderRight: "1.5px solid rgba(34,211,238,0.35)",
              flexShrink: 0,
            }}
          >
            <DropIcon size={116} />
          </div>

          {/* Title block */}
          <div style={{ flex: 1, padding: "0 40px", position: "relative" }}>
            <div style={{ color: AQUA, fontSize: 25, fontWeight: 800, letterSpacing: 7, marginBottom: 8 }}>
              MUNDIAL 2026 &bull; PAUSA T&Eacute;CNICA
            </div>
            <div style={{ position: "relative", overflow: "hidden", display: "inline-block" }}>
              <div style={{ fontSize: 66, fontWeight: 900, color: WHITE, letterSpacing: 3, whiteSpace: "nowrap" }}>
                {letters.map((ch, i) => {
                  const lp = easeOut(frame, 12 + i * 2.2, 20);
                  return (
                    <span
                      key={i}
                      style={{
                        display: "inline-block",
                        opacity: lp,
                        transform: `translateY(${(1 - lp) * 34}px)`,
                        width: ch === " " ? 24 : undefined,
                      }}
                    >
                      {ch === " " ? " " : ch}
                    </span>
                  );
                })}
              </div>
              {/* Shimmer over the title */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: `${shimmerX}%`,
                  width: "22%",
                  background:
                    "linear-gradient(100deg, rgba(165,243,252,0) 0%, rgba(165,243,252,0.35) 50%, rgba(165,243,252,0) 100%)",
                  transform: "skewX(-18deg)",
                  pointerEvents: "none",
                }}
              />
            </div>
          </div>

          {/* Timer block */}
          <div
            style={{
              width: 300,
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              background: "linear-gradient(160deg, rgba(8,145,178,0.32), rgba(7,16,36,0.2))",
              borderLeft: "1.5px solid rgba(34,211,238,0.35)",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                fontSize: 74,
                fontWeight: 900,
                color: WHITE,
                letterSpacing: 2,
                fontVariantNumeric: "tabular-nums",
                textShadow: `0 0 26px rgba(34,211,238,0.55)`,
                transform: `scale(${timerPulse})`,
              }}
            >
              {mm}:{ss}
            </div>
            {/* Draining progress bar */}
            <div
              style={{
                width: 190,
                height: 9,
                borderRadius: 5,
                background: "rgba(255,255,255,0.12)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${timerFrac * 100}%`,
                  height: "100%",
                  borderRadius: 5,
                  background: `linear-gradient(90deg, ${AQUA_DEEP}, ${AQUA_LIGHT})`,
                }}
              />
            </div>
            <div style={{ color: TEXT_DIM, fontSize: 21, fontWeight: 700, letterSpacing: 4 }}>
              HIDRATA&Ccedil;&Atilde;O
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
