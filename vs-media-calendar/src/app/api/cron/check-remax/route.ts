import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { checkRemaxSold } from "@/lib/remax"
import { Resend } from "resend"

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

function getResend() {
  return new Resend(process.env.RESEND_API_KEY!)
}

function formatEur(n: number) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(n)
}

export async function GET(req: NextRequest) {
  // Allow Vercel cron or admin secret
  const secret = req.nextUrl.searchParams.get("secret")
  if (secret !== process.env.CRON_SECRET && req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Find all bookings with a Remax URL that haven't been flagged as sold yet
  const bookings = await prisma.booking.findMany({
    where: {
      remaxUrl: { not: null },
      remaxSoldAt: null,
    },
    include: {
      consultant: { select: { name: true, email: true } },
    },
  })

  const results: { id: string; address: string; sold: boolean; error?: string }[] = []

  for (const booking of bookings) {
    if (!booking.remaxUrl) continue
    try {
      const sold = await checkRemaxSold(booking.remaxUrl)
      if (sold) {
        await prisma.booking.update({
          where: { id: booking.id },
          data: { remaxSoldAt: new Date() },
        })

        const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL
        if (adminEmail) {
          const commissionPct = ((booking.commissionRate ?? 0.0015) * 100).toFixed(2)
          const html = `
<!DOCTYPE html>
<html lang="pt">
<head><meta charset="UTF-8"><title>Imóvel Vendido</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <div style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);padding:32px;text-align:center;">
        <h1 style="color:white;margin:0;font-size:24px;font-weight:700;">VS.Media Calendar</h1>
        <p style="color:rgba(255,255,255,0.7);margin:8px 0 0;font-size:14px;">Agendamento de Serviços Imobiliários</p>
      </div>
      <div style="padding:32px;">
        <h2 style="color:#1a1a2e;margin:0 0 8px;font-size:20px;">🏠 Imóvel Vendido Detectado</h2>
        <p style="color:#666;margin:0 0 24px;">Um imóvel em modo comissão foi marcado como vendido na Remax.</p>

        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin-bottom:24px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="color:#666;padding:6px 0;font-size:14px;width:40%;">Imóvel</td><td style="color:#1a1a2e;padding:6px 0;font-size:14px;font-weight:600;">${booking.propertyAddress}</td></tr>
            <tr><td style="color:#666;padding:6px 0;font-size:14px;">Consultor</td><td style="color:#1a1a2e;padding:6px 0;font-size:14px;font-weight:600;">${booking.consultant.name || booking.consultant.email}</td></tr>
            <tr><td style="color:#666;padding:6px 0;font-size:14px;">Comissão</td><td style="color:#16a34a;padding:6px 0;font-size:14px;font-weight:700;">${commissionPct}% do valor de venda</td></tr>
            ${booking.salePrice ? `<tr><td style="color:#666;padding:6px 0;font-size:14px;">Valor de venda</td><td style="color:#16a34a;padding:6px 0;font-size:16px;font-weight:700;">${formatEur(booking.salePrice)}</td></tr>` : ""}
          </table>
        </div>

        <p style="color:#666;font-size:14px;margin:0 0 24px;">
          Por favor confirma o valor de venda na plataforma para que a comissão seja calculada correctamente.
        </p>

        <a href="${APP_URL}/admin/bookings/${booking.id}" style="display:inline-block;background:#0f3460;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600;">Ver Marcação →</a>

        <p style="margin-top:20px;">
          <a href="${booking.remaxUrl}" style="color:#0f3460;font-size:13px;">Ver anúncio na Remax</a>
        </p>
      </div>
      <div style="background:#f9f9f9;padding:20px;text-align:center;border-top:1px solid #eee;">
        <p style="color:#999;font-size:12px;margin:0;">VS.Media Calendar · <a href="${APP_URL}" style="color:#0f3460;text-decoration:none;">Aceder à plataforma</a></p>
      </div>
    </div>
  </div>
</body>
</html>`

          await getResend().emails.send({
            from: process.env.EMAIL_FROM || "VS.Media Calendar <noreply@vsmedia.pt>",
            to: adminEmail,
            subject: `🏠 Imóvel vendido — ${booking.propertyAddress}`,
            html,
          })
        }
      }
      results.push({ id: booking.id, address: booking.propertyAddress, sold })
    } catch (e: any) {
      results.push({ id: booking.id, address: booking.propertyAddress, sold: false, error: e.message })
    }
  }

  return NextResponse.json({ checked: results.length, results })
}
