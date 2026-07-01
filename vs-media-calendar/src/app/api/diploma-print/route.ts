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
  const names = searchParams.getAll("name")
  const images = searchParams.getAll("image")
  const metric = Number(searchParams.get("metric") ?? "0")
  const metricLabel = searchParams.get("metricLabel") ?? ""

  const cfg = CONFIG[type] ?? CONFIG.video
  const displayMetric = type === "spender" ? null : String(metric)
  const isTie = names.length > 1
  const winners = names.map((n, i) => ({ name: n || "—", image: images[i] || "" }))

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
.brand{height:14px;width:auto;opacity:.35}
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
.winners-row{display:flex;justify-content:center;gap:28px;flex-wrap:wrap}
.winner-item{display:flex;flex-direction:column;align-items:center;gap:10px}
.avatar,.avatar-ph{
  width:88px;height:88px;border-radius:50%;
  border:4px solid rgba(${cfg.accentRgb},.4);
  margin:0 auto 14px;
}
.avatar-sm,.avatar-ph-sm{
  width:68px;height:68px;border-radius:50%;
  border:3px solid rgba(${cfg.accentRgb},.4);
}
.avatar,.avatar-sm{display:block;object-fit:cover}
.avatar-ph{
  display:flex;align-items:center;justify-content:center;
  background:rgba(${cfg.accentRgb},.1);
  font-size:34px;font-weight:900;color:${cfg.accent};
}
.avatar-ph-sm{
  display:flex;align-items:center;justify-content:center;
  background:rgba(${cfg.accentRgb},.1);
  font-size:26px;font-weight:900;color:${cfg.accent};
}
.wname{color:#fff;font-size:30px;font-weight:900;letter-spacing:-1px}
.wname-sm{color:#fff;font-size:20px;font-weight:800;letter-spacing:-.5px}
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
      <svg class="brand" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 476.51 68.49"><g><path fill="#fff" d="M24.95,67.3L0,.99h19.38l16.4,47.82L52.09.99h19.38l-24.95,66.31h-21.57Z"/><path fill="#fff" d="M71.57,57.96l9.05-13.32c4.77,4.77,12.13,8.75,21.27,8.75,5.77,0,9.34-1.99,9.34-5.27,0-8.75-37.48-1.49-37.48-27.04,0-11.13,9.34-21.07,26.34-21.07,10.64,0,19.88,3.18,26.94,9.24l-9.34,12.83c-5.57-4.67-12.82-6.96-19.38-6.96-4.97,0-7.16,1.69-7.16,4.57,0,8.15,37.48,1.99,37.48,26.64,0,13.32-9.84,22.17-27.64,22.17-13.42,0-22.76-4.27-29.42-10.54Z"/><path fill="#fff" d="M137.62,67.3v-12.65s17.1-6.5,17.1-6.5v19.15h-17.1Z"/></g><g><path fill="#fff" d="M176.88.99l24.26,48.14L225.31.99h9.29v66.34h-7.01l-.1-55.15-24.16,48.14h-4.55l-24.07-48.14v55.15h-7.2V.99h9.38Z"/><path fill="#fff" d="M299.79.99v7.01h-37.43v22.27h33.45v6.92h-33.45v23.12h38.66v7.01h-46.24V.99h45.01Z"/><path fill="#fff" d="M377.4,34.16c0,18.86-14.88,33.17-34.4,33.17h-26.53V.99h26.82c19.33,0,34.12,14.31,34.12,33.17ZM369.72,34.26c0-14.97-11.75-26.25-26.63-26.25h-19.05v52.31h19.33c14.78,0,26.34-11.18,26.34-26.06Z"/><path fill="#fff" d="M398.81.99v66.34h-7.58V.99h7.58Z"/><path fill="#fff" d="M460.78,50.37h-36.1l-7.39,16.96h-8.05L438.98.99h7.87l29.66,66.34h-8.24l-7.49-16.96ZM457.75,43.35l-15.07-34.12-14.88,34.12h29.95Z"/></g></svg>
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
      <div class="wlabel">${isTie ? "Atribuído a (empate)" : "Atribuído a"}</div>
      ${isTie
        ? `<div class="winners-row">${winners.map(w =>
            `<div class="winner-item">
              ${w.image
                ? `<img src="${w.image}" class="avatar-sm" alt="${w.name}" crossorigin="anonymous"/>`
                : `<div class="avatar-ph-sm">${w.name[0] ?? "?"}</div>`}
              <div class="wname-sm">${w.name}</div>
            </div>`
          ).join("")}</div>`
        : `${winners[0]?.image
            ? `<img src="${winners[0].image}" class="avatar" alt="${winners[0].name}" crossorigin="anonymous"/>`
            : `<div class="avatar-ph">${winners[0]?.name[0] ?? "?"}</div>`}
          <div class="wname">${winners[0]?.name ?? "—"}</div>`
      }
    </div>
    ${displayMetric !== null ? `<div class="metric-box">
      <div class="mvalue">${displayMetric}</div>
      <div class="mtext">${metricLabel}</div>
    </div>` : ""}
    <div class="footer">
      <svg style="height:10px;width:auto;opacity:.22" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 476.51 68.49"><g><path fill="#fff" d="M24.95,67.3L0,.99h19.38l16.4,47.82L52.09.99h19.38l-24.95,66.31h-21.57Z"/><path fill="#fff" d="M71.57,57.96l9.05-13.32c4.77,4.77,12.13,8.75,21.27,8.75,5.77,0,9.34-1.99,9.34-5.27,0-8.75-37.48-1.49-37.48-27.04,0-11.13,9.34-21.07,26.34-21.07,10.64,0,19.88,3.18,26.94,9.24l-9.34,12.83c-5.57-4.67-12.82-6.96-19.38-6.96-4.97,0-7.16,1.69-7.16,4.57,0,8.15,37.48,1.99,37.48,26.64,0,13.32-9.84,22.17-27.64,22.17-13.42,0-22.76-4.27-29.42-10.54Z"/><path fill="#fff" d="M137.62,67.3v-12.65s17.1-6.5,17.1-6.5v19.15h-17.1Z"/></g><g><path fill="#fff" d="M176.88.99l24.26,48.14L225.31.99h9.29v66.34h-7.01l-.1-55.15-24.16,48.14h-4.55l-24.07-48.14v55.15h-7.2V.99h9.38Z"/><path fill="#fff" d="M299.79.99v7.01h-37.43v22.27h33.45v6.92h-33.45v23.12h38.66v7.01h-46.24V.99h45.01Z"/><path fill="#fff" d="M377.4,34.16c0,18.86-14.88,33.17-34.4,33.17h-26.53V.99h26.82c19.33,0,34.12,14.31,34.12,33.17ZM369.72,34.26c0-14.97-11.75-26.25-26.63-26.25h-19.05v52.31h19.33c14.78,0,26.34-11.18,26.34-26.06Z"/><path fill="#fff" d="M398.81.99v66.34h-7.58V.99h7.58Z"/><path fill="#fff" d="M460.78,50.37h-36.1l-7.39,16.96h-8.05L438.98.99h7.87l29.66,66.34h-8.24l-7.49-16.96ZM457.75,43.35l-15.07-34.12-14.88,34.12h29.95Z"/></g></svg>
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
