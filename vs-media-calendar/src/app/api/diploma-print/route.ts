import { NextRequest } from "next/server"

type DiplomaType = "video" | "intros" | "spender"

const CONFIG: Record<DiplomaType, {
  title: string
  subtitle: string
  gradient: string
  accent: string
  accentRgb: string
  emoji: string
}> = {
  video: {
    title: "Campeão dos Vídeos",
    subtitle: "Pelo desempenho excecional na realização de vídeos imobiliários",
    gradient: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f3460 100%)",
    accent: "#60a5fa",
    accentRgb: "96,165,250",
    emoji: "🎬",
  },
  intros: {
    title: "Campeão das Intros",
    subtitle: "Pelo contributo excecional na criação de intros partilhadas",
    gradient: "linear-gradient(135deg, #1a0533 0%, #3b0764 50%, #4c1d95 100%)",
    accent: "#c084fc",
    accentRgb: "192,132,252",
    emoji: "✨",
  },
  spender: {
    title: "Big Spender",
    subtitle: "Pelo maior investimento em marketing imobiliário de qualidade",
    gradient: "linear-gradient(135deg, #1c1003 0%, #78350f 50%, #92400e 100%)",
    accent: "#fbbf24",
    accentRgb: "251,191,36",
    emoji: "🏆",
  },
}

function formatEuro(amount: number) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(amount)
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const type = (searchParams.get("type") ?? "video") as DiplomaType
  const month = searchParams.get("month") ?? ""
  const name = searchParams.get("name") ?? "—"
  const metric = Number(searchParams.get("metric") ?? "0")
  const metricLabel = searchParams.get("metricLabel") ?? ""
  const image = searchParams.get("image") ?? ""

  const cfg = CONFIG[type] ?? CONFIG.video
  const displayMetric = type === "spender" ? formatEuro(metric) : String(metric)
  const initials = name[0] ?? "?"

  const html = `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Diploma VS Media — ${cfg.title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap" rel="stylesheet"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{
  font-family:'Inter',system-ui,sans-serif;
  background:#060d17;
  min-height:100vh;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  padding:40px 24px;
  gap:24px;
}
.diploma{
  width:580px;
  max-width:100%;
  border-radius:28px;
  overflow:hidden;
  background:${cfg.gradient};
  position:relative;
  box-shadow:0 40px 80px rgba(0,0,0,.7),0 0 0 1px rgba(255,255,255,.05);
}
.stripe{
  height:5px;
  background:linear-gradient(90deg,transparent 0%,${cfg.accent} 50%,transparent 100%);
}
.body{padding:40px 48px;position:relative;overflow:hidden}
.ring1{
  position:absolute;pointer-events:none;
  top:-60px;right:-60px;
  width:220px;height:220px;border-radius:50%;
  border:1px solid rgba(${cfg.accentRgb},.13);
}
.ring2{
  position:absolute;pointer-events:none;
  bottom:-80px;left:-60px;
  width:280px;height:280px;border-radius:50%;
  border:1px solid rgba(${cfg.accentRgb},.10);
}
.header{display:flex;justify-content:space-between;align-items:center;margin-bottom:32px;position:relative;z-index:1}
.brand{color:rgba(255,255,255,.35);font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase}
.mlabel{color:rgba(255,255,255,.28);font-size:11px;text-transform:capitalize}
.center{text-align:center;margin-bottom:32px;position:relative;z-index:1}
.icon-wrap{
  display:inline-flex;align-items:center;justify-content:center;
  width:68px;height:68px;border-radius:18px;
  background:rgba(${cfg.accentRgb},.12);
  border:1px solid rgba(${cfg.accentRgb},.25);
  font-size:34px;margin-bottom:14px;
}
.title{color:#fff;font-size:24px;font-weight:800;letter-spacing:-.5px;margin-bottom:6px}
.subtitle{color:${cfg.accent};font-size:12px;opacity:.72;line-height:1.5}
.divider{display:flex;align-items:center;gap:10px;margin-bottom:32px;position:relative;z-index:1}
.dline{flex:1;height:1px;background:rgba(${cfg.accentRgb},.18)}
.ddot{width:5px;height:5px;border-radius:50%;background:rgba(${cfg.accentRgb},.4)}
.winner{text-align:center;margin-bottom:28px;position:relative;z-index:1}
.wlabel{color:rgba(255,255,255,.38);font-size:9px;font-weight:700;letter-spacing:3.5px;text-transform:uppercase;margin-bottom:18px}
.avatar,.avatar-ph{
  width:88px;height:88px;border-radius:50%;
  border:4px solid rgba(${cfg.accentRgb},.4);
  margin:0 auto 14px;
}
.avatar{display:block;object-fit:cover}
.avatar-ph{
  display:flex;align-items:center;justify-content:center;
  background:rgba(${cfg.accentRgb},.1);
  font-size:34px;font-weight:900;color:${cfg.accent};
}
.wname{color:#fff;font-size:30px;font-weight:900;letter-spacing:-1px}
.metric-box{
  text-align:center;
  border-radius:18px;
  border:1px solid rgba(${cfg.accentRgb},.22);
  background:rgba(${cfg.accentRgb},.09);
  padding:20px 24px;
  margin-bottom:28px;
  position:relative;z-index:1;
}
.mvalue{color:${cfg.accent};font-size:42px;font-weight:900;letter-spacing:-1.5px;line-height:1}
.mtext{color:rgba(255,255,255,.45);font-size:12px;margin-top:6px}
.footer{
  border-top:1px solid rgba(255,255,255,.07);
  padding-top:18px;
  display:flex;justify-content:space-between;align-items:center;
  position:relative;z-index:1;
}
.fbrand{color:rgba(255,255,255,.22);font-size:10px;letter-spacing:1px}
.dots{display:flex;gap:4px}
.dot{width:5px;height:5px;border-radius:50%;background:${cfg.accent}}
.actions{display:flex;gap:12px}
.btn{
  padding:10px 24px;border-radius:12px;font-size:13px;font-weight:600;
  cursor:pointer;border:none;font-family:inherit;
}
.btn-p{background:#fff;color:#0f172a}
.btn-s{background:rgba(255,255,255,.08);color:rgba(255,255,255,.7);border:1px solid rgba(255,255,255,.12)}
@media print{
  body{background:#fff!important;padding:0!important}
  .diploma{box-shadow:none!important;width:100%!important}
  .actions{display:none!important}
}
</style>
</head>
<body>
<div class="diploma">
  <div class="stripe"></div>
  <div class="body">
    <div class="ring1"></div>
    <div class="ring2"></div>
    <div class="header">
      <span class="brand">VS Media</span>
      <span class="mlabel">${month}</span>
    </div>
    <div class="center">
      <div class="icon-wrap">${cfg.emoji}</div>
      <div class="title">${cfg.title}</div>
      <div class="subtitle">${cfg.subtitle}</div>
    </div>
    <div class="divider">
      <div class="dline"></div><div class="ddot"></div><div class="dline"></div>
    </div>
    <div class="winner">
      <div class="wlabel">Atribuído a</div>
      ${image ? `<img src="${image}" class="avatar" alt="${name}" crossorigin="anonymous"/>` : `<div class="avatar-ph">${initials}</div>`}
      <div class="wname">${name}</div>
    </div>
    <div class="metric-box">
      <div class="mvalue">${displayMetric}</div>
      <div class="mtext">${metricLabel}</div>
    </div>
    <div class="footer">
      <span class="fbrand">vs.media</span>
      <div class="dots">
        <div class="dot" style="opacity:.25"></div>
        <div class="dot" style="opacity:.40"></div>
        <div class="dot" style="opacity:.55"></div>
        <div class="dot" style="opacity:.70"></div>
        <div class="dot" style="opacity:.85"></div>
      </div>
    </div>
  </div>
  <div class="stripe"></div>
</div>
<div class="actions">
  <button class="btn btn-p" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
  <button class="btn btn-s" onclick="window.close()">Fechar</button>
</div>
</body>
</html>`

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  })
}
