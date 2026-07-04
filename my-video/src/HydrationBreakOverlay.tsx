import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ANTON_WOFF2_BASE64 } from "./fonts/anton";

// FIFA World Cup 26 style hydration break banner, rendered on a transparent
// background so it can be dropped on top of any video as an overlay.

// ── FIFA 26 gradient palette (sampled from the broadcast banner) ─────────────
const BLUE = "#2f52e0";
const LIME = "#cfe22e";
const ORANGE = "#ff6a1a";
const RED = "#ee3123";
const PURPLE = "#9b30d9";

const BANNER_W = 1560;
const BANNER_H = 250;
const BORDER = 14;

// When `chroma` is set, the banner is rendered over that solid color (for
// chroma keying) and the drop shadow is removed so no dark halo survives the key.
export const HydrationBreakOverlay: React.FC<{ chroma?: string }> = ({ chroma }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();

  const OUT_START = durationInFrames - 24;

  // Entrance: pop in with a slight overshoot
  const enter = spring({
    frame,
    fps,
    config: { damping: 13, stiffness: 130, mass: 0.8 },
  });
  const exitP = interpolate(frame - OUT_START, [0, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });
  const scale = 0.65 + enter * 0.35 - exitP * 0.08;
  const opacity = Math.min(1, enter * 2.2) * (1 - exitP);

  // Text lands just after the capsule
  const textIn = spring({
    frame: frame - 6,
    fps,
    config: { damping: 14, stiffness: 140, mass: 0.7 },
  });

  // Gradient border: slow oscillation so the colors stay roughly in place
  const gradAngle = Math.sin((frame / fps) * Math.PI * 2 * 0.12) * 3;

  // Gloss sweep across the black capsule every ~3.2s
  const sweepLoop = 3.2 * fps;
  const sweepP = ((frame + 20) % sweepLoop) / sweepLoop;
  const sweepX = interpolate(sweepP, [0, 0.4], [-30, 125], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: chroma }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `@font-face {
            font-family: 'Anton';
            src: url(data:font/woff2;base64,${ANTON_WOFF2_BASE64}) format('woff2');
            font-weight: 400;
            font-style: normal;
          }`,
        }}
      />

      <div
        style={{
          position: "absolute",
          left: (width - BANNER_W) / 2,
          top: height - BANNER_H - 110,
          width: BANNER_W,
          height: BANNER_H,
          transform: `scale(${scale})`,
          opacity,
          filter: chroma ? undefined : "drop-shadow(0 18px 40px rgba(0,0,0,0.45))",
        }}
      >
        {/* Gradient border capsule */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: BANNER_H / 2,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: BANNER_W * 1.35,
              height: BANNER_W * 1.35,
              transform: `translate(-50%, -50%) rotate(${gradAngle}deg)`,
              background: `conic-gradient(from 0deg,
                ${BLUE} 0deg,
                ${BLUE} 76deg,
                ${LIME} 84deg,
                ${LIME} 98deg,
                ${ORANGE} 112deg,
                ${ORANGE} 200deg,
                ${RED} 236deg,
                ${RED} 274deg,
                ${PURPLE} 279deg,
                ${PURPLE} 284deg,
                ${BLUE} 291deg,
                ${BLUE} 360deg)`,
            }}
          />
        </div>

        {/* Black glossy interior */}
        <div
          style={{
            position: "absolute",
            inset: BORDER,
            borderRadius: (BANNER_H - BORDER * 2) / 2,
            background: "#0a0a0c",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "inset 0 6px 18px rgba(0,0,0,0.9)",
          }}
        >
          {/* Top gloss reflection */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: "4%",
              right: "4%",
              height: "46%",
              borderRadius: "50% / 100% 100% 0 0",
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.04) 60%, rgba(255,255,255,0) 100%)",
            }}
          />
          {/* Moving light sweep */}
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `${sweepX}%`,
              width: "16%",
              background:
                "linear-gradient(100deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.13) 50%, rgba(255,255,255,0) 100%)",
              transform: "skewX(-20deg)",
            }}
          />

          {/* Title */}
          <div
            style={{
              fontFamily: "'Anton', 'Liberation Sans', Arial, sans-serif",
              fontSize: 148,
              color: "#ffffff",
              letterSpacing: 4,
              whiteSpace: "nowrap",
              transform: `scale(${0.86 + textIn * 0.14}) scaleY(0.96)`,
              opacity: Math.min(1, textIn * 1.6),
              textShadow: "0 4px 10px rgba(0,0,0,0.55)",
              paddingTop: 6,
            }}
          >
            HYDRATION&nbsp;BREAK
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
