// VS.MEDIA brand logo component
// Replicates the brand typography: black-weight "VS." + regular-weight "MEDIA"

interface VsMediaLogoProps {
  variant?: "white" | "dark"
  size?: "sm" | "md" | "lg" | "xl"
  subtitle?: string
  className?: string
}

const sizes = {
  sm:  "text-lg",
  md:  "text-xl",
  lg:  "text-2xl",
  xl:  "text-4xl",
}

export function VsMediaLogo({
  variant = "dark",
  size = "md",
  subtitle,
  className = "",
}: VsMediaLogoProps) {
  const isDark = variant === "dark"
  const mainColor = isDark ? "#142850" : "#ffffff"
  const subColor  = isDark ? "#94a3b8" : "rgba(255,255,255,0.45)"

  return (
    <div className={className}>
      <div
        className={`flex items-baseline leading-none ${sizes[size]}`}
        style={{ color: mainColor }}
      >
        {/* VS. — black weight */}
        <span style={{ fontWeight: 900, letterSpacing: "-0.03em" }}>VS</span>
        <span style={{ fontWeight: 900, letterSpacing: "-0.03em" }}>.</span>
        {/* MEDIA — regular weight */}
        <span style={{ fontWeight: 400, letterSpacing: "0.06em", marginLeft: "0.12em" }}>
          MEDIA
        </span>
      </div>
      {subtitle && (
        <p
          className="text-xs mt-0.5 tracking-widest uppercase"
          style={{ color: subColor, fontSize: "0.65em", letterSpacing: "0.18em" }}
        >
          {subtitle}
        </p>
      )}
    </div>
  )
}
