import { Resend } from "resend"
import type { BookingStatus } from "@prisma/client"

let _resend: Resend | null = null
function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY
    if (!key) throw new Error("RESEND_API_KEY environment variable is not set")
    _resend = new Resend(key)
  }
  return _resend
}

const FROM = process.env.EMAIL_FROM || "VS.Media Calendar <noreply@vsmedia.pt>"
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

interface BookingEmailData {
  bookingId: string
  consultantName: string
  consultantEmail: string
  videographerName: string
  videographerEmail: string
  propertyAddress: string
  propertyType?: string | null
  scheduledAt: Date
  services: string[]
  totalAmount?: number
  status: BookingStatus
  durationMinutes?: number
}

function formatPropertyType(type?: string | null): string {
  if (!type) return ""
  return type === "T5_PLUS" ? "T5+" : type
}

function formatICSDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
}

export function generateICS(data: BookingEmailData): string {
  const start = new Date(data.scheduledAt)
  const end = new Date(start)
  end.setMinutes(end.getMinutes() + (data.durationMinutes ?? 90))

  const description = [
    `Consultor: ${data.consultantName}`,
    `Videógrafo: ${data.videographerName}`,
    `Serviços: ${data.services.join(", ")}`,
    `Ver marcação: ${APP_URL}/consultant/bookings/${data.bookingId}`,
  ].join("\\n")

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//VS Media Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${data.bookingId}@calendar.vsmedia.pt`,
    `DTSTAMP:${formatICSDate(new Date())}`,
    `DTSTART:${formatICSDate(start)}`,
    `DTEND:${formatICSDate(end)}`,
    `SUMMARY:📸 ${data.propertyAddress}${data.propertyType ? ` (${formatPropertyType(data.propertyType)})` : ""}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${data.propertyAddress}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n")
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-PT", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(amount)
}

const emailBase = (content: string) => `
<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VS.Media Calendar</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <div style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);padding:32px;text-align:center;">
        <h1 style="color:white;margin:0;font-size:24px;font-weight:700;letter-spacing:-0.5px;">VS.Media Calendar</h1>
        <p style="color:rgba(255,255,255,0.7);margin:8px 0 0;font-size:14px;">Agendamento de Serviços Imobiliários</p>
      </div>
      <div style="padding:32px;">
        ${content}
      </div>
      <div style="background:#f9f9f9;padding:20px;text-align:center;border-top:1px solid #eee;">
        <p style="color:#999;font-size:12px;margin:0;">
          VS.Media Calendar · <a href="${APP_URL}" style="color:#0f3460;text-decoration:none;">Aceder à plataforma</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>
`

export async function sendBookingConfirmationEmail(data: BookingEmailData) {
  const content = `
    <h2 style="color:#1a1a2e;margin:0 0 8px;font-size:20px;">Pedido de Marcação Enviado</h2>
    <p style="color:#666;margin:0 0 24px;">O seu pedido foi enviado ao videógrafo e está a aguardar confirmação.</p>

    <div style="background:#f8f9fa;border-radius:8px;padding:20px;margin-bottom:24px;">
      <h3 style="color:#1a1a2e;margin:0 0 16px;font-size:14px;text-transform:uppercase;letter-spacing:1px;">Detalhes da Marcação</h3>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="color:#666;padding:6px 0;font-size:14px;width:40%;">Data e Hora</td><td style="color:#1a1a2e;padding:6px 0;font-size:14px;font-weight:600;">${formatDate(data.scheduledAt)}</td></tr>
        <tr><td style="color:#666;padding:6px 0;font-size:14px;">Imóvel</td><td style="color:#1a1a2e;padding:6px 0;font-size:14px;font-weight:600;">${data.propertyAddress}${data.propertyType ? ` <span style="color:#666;font-weight:400;">(${formatPropertyType(data.propertyType)})</span>` : ""}</td></tr>
        <tr><td style="color:#666;padding:6px 0;font-size:14px;">Videógrafo</td><td style="color:#1a1a2e;padding:6px 0;font-size:14px;font-weight:600;">${data.videographerName}</td></tr>
        <tr><td style="color:#666;padding:6px 0;font-size:14px;">Serviços</td><td style="color:#1a1a2e;padding:6px 0;font-size:14px;font-weight:600;">${data.services.join(", ")}</td></tr>
        ${data.totalAmount ? `<tr><td style="color:#666;padding:6px 0;font-size:14px;">Total Pago</td><td style="color:#10b981;padding:6px 0;font-size:14px;font-weight:700;">${formatAmount(data.totalAmount)}</td></tr>` : ""}
      </table>
    </div>

    <a href="${APP_URL}/consultant/bookings/${data.bookingId}" style="display:inline-block;background:#0f3460;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">Ver Marcação</a>
  `

  const result = await getResend().emails.send({
    from: FROM,
    to: data.consultantEmail,
    subject: `Pedido de marcação enviado — ${formatDate(data.scheduledAt)}`,
    html: emailBase(content),
  })
  console.log(`[email] sendBookingConfirmationEmail → ${data.consultantEmail}`, result)
  return result
}

export async function sendVideographerRequestEmail(data: BookingEmailData) {
  const content = `
    <h2 style="color:#1a1a2e;margin:0 0 8px;font-size:20px;">Novo Pedido de Serviço</h2>
    <p style="color:#666;margin:0 0 24px;">Recebeu um novo pedido de agendamento. Por favor aceite ou recuse o pedido.</p>

    <div style="background:#f8f9fa;border-radius:8px;padding:20px;margin-bottom:24px;">
      <h3 style="color:#1a1a2e;margin:0 0 16px;font-size:14px;text-transform:uppercase;letter-spacing:1px;">Detalhes do Serviço</h3>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="color:#666;padding:6px 0;font-size:14px;width:40%;">Data e Hora</td><td style="color:#1a1a2e;padding:6px 0;font-size:14px;font-weight:600;">${formatDate(data.scheduledAt)}</td></tr>
        <tr><td style="color:#666;padding:6px 0;font-size:14px;">Imóvel</td><td style="color:#1a1a2e;padding:6px 0;font-size:14px;font-weight:600;">${data.propertyAddress}${data.propertyType ? ` <span style="color:#666;font-weight:400;">(${formatPropertyType(data.propertyType)})</span>` : ""}</td></tr>
        <tr><td style="color:#666;padding:6px 0;font-size:14px;">Consultor</td><td style="color:#1a1a2e;padding:6px 0;font-size:14px;font-weight:600;">${data.consultantName}</td></tr>
        <tr><td style="color:#666;padding:6px 0;font-size:14px;">Serviços</td><td style="color:#1a1a2e;padding:6px 0;font-size:14px;font-weight:600;">${data.services.join(", ")}</td></tr>
        <tr><td style="color:#666;padding:6px 0;font-size:14px;">Duração</td><td style="color:#1a1a2e;padding:6px 0;font-size:14px;font-weight:600;">1h30</td></tr>
      </table>
    </div>

    <div style="display:flex;gap:12px;">
      <a href="${APP_URL}/videographer/bookings/${data.bookingId}?action=accept" style="display:inline-block;background:#10b981;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;margin-right:12px;">Aceitar</a>
      <a href="${APP_URL}/videographer/bookings/${data.bookingId}?action=reject" style="display:inline-block;background:#ef4444;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">Recusar</a>
    </div>
  `

  const result = await getResend().emails.send({
    from: FROM,
    to: data.videographerEmail,
    subject: `Novo pedido de serviço — ${formatDate(data.scheduledAt)}`,
    html: emailBase(content),
  })
  console.log(`[email] sendVideographerRequestEmail → ${data.videographerEmail}`, result)
  return result
}

export async function sendInviteEmail({
  email,
  role,
}: {
  email: string
  role: string
}) {
  const roleLabel =
    role === "VIDEOGRAPHER" ? "Videógrafo" : role === "ADMIN" ? "Administrador" : "Consultor"

  const roleDescription =
    role === "VIDEOGRAPHER"
      ? "Poderás gerir os teus serviços, ver pedidos e acompanhar a tua agenda."
      : "Poderás agendar sessões de vídeo e fotografia imobiliária de forma simples e rápida."

  const content = `
    <h2 style="color:#1a1a2e;margin:0 0 8px;font-size:20px;">Foste convidado para o VS.Brothers Calendar</h2>
    <p style="color:#666;margin:0 0 24px;">
      Tens acesso à plataforma como <strong style="color:#0f3460;">${roleLabel}</strong>.<br/>
      ${roleDescription}
    </p>

    <div style="background:#f8f9fa;border-radius:8px;padding:20px;margin-bottom:24px;">
      <p style="color:#444;font-size:14px;margin:0 0 8px;"><strong>Como aceder:</strong></p>
      <ol style="color:#666;font-size:14px;margin:0;padding-left:20px;line-height:2;">
        <li>Clica no botão abaixo</li>
        <li>Inicia sessão com a tua conta Google (<strong>${email}</strong>)</li>
        <li>Preenche os teus dados na primeira vez que entras</li>
      </ol>
    </div>

    <a href="${APP_URL}/login" style="display:inline-block;background:#0f3460;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600;">
      Aceder à plataforma →
    </a>

    <p style="color:#aaa;font-size:12px;margin-top:24px;">
      Se não esperavas este convite, podes ignorar este email.
    </p>
  `

  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: "Convite para VS.Brothers Calendar",
    html: emailBase(content),
  })
}

export async function sendAdminBookingNotificationEmail(data: BookingEmailData) {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL
  if (!adminEmail) return

  const content = `
    <h2 style="color:#1a1a2e;margin:0 0 8px;font-size:20px;">Nova Marcação Criada</h2>
    <p style="color:#666;margin:0 0 24px;">Uma nova marcação foi registada na plataforma.</p>

    <div style="background:#f8f9fa;border-radius:8px;padding:20px;margin-bottom:24px;">
      <h3 style="color:#1a1a2e;margin:0 0 16px;font-size:14px;text-transform:uppercase;letter-spacing:1px;">Detalhes</h3>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="color:#666;padding:6px 0;font-size:14px;width:40%;">Data e Hora</td><td style="color:#1a1a2e;padding:6px 0;font-size:14px;font-weight:600;">${formatDate(data.scheduledAt)}</td></tr>
        <tr><td style="color:#666;padding:6px 0;font-size:14px;">Consultor</td><td style="color:#1a1a2e;padding:6px 0;font-size:14px;font-weight:600;">${data.consultantName} <span style="color:#999;font-weight:400;">(${data.consultantEmail})</span></td></tr>
        <tr><td style="color:#666;padding:6px 0;font-size:14px;">Videógrafo</td><td style="color:#1a1a2e;padding:6px 0;font-size:14px;font-weight:600;">${data.videographerName}</td></tr>
        <tr><td style="color:#666;padding:6px 0;font-size:14px;">Imóvel</td><td style="color:#1a1a2e;padding:6px 0;font-size:14px;font-weight:600;">${data.propertyAddress}${data.propertyType ? ` (${formatPropertyType(data.propertyType)})` : ""}</td></tr>
        <tr><td style="color:#666;padding:6px 0;font-size:14px;">Serviços</td><td style="color:#1a1a2e;padding:6px 0;font-size:14px;font-weight:600;">${data.services.join(", ")}</td></tr>
        ${data.totalAmount ? `<tr><td style="color:#666;padding:6px 0;font-size:14px;">Total</td><td style="color:#0f3460;padding:6px 0;font-size:14px;font-weight:700;">${formatAmount(data.totalAmount)}</td></tr>` : ""}
      </table>
    </div>

    <a href="${APP_URL}/admin/bookings/${data.bookingId}" style="display:inline-block;background:#0f3460;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">Ver no Admin</a>
  `

  const result = await getResend().emails.send({
    from: FROM,
    to: adminEmail,
    subject: `Nova marcação — ${data.consultantName} · ${formatDate(data.scheduledAt)}`,
    html: emailBase(content),
  })
  console.log(`[email] sendAdminBookingNotificationEmail → ${adminEmail}`, result)
  return result
}

export async function sendInvoicePaidConfirmationEmail({
  consultantName,
  consultantEmail,
  month,
  total,
  invoiceId,
}: {
  consultantName: string
  consultantEmail: string
  month: string
  total: number
  invoiceId: string
}) {
  if (!consultantEmail) return

  const [year, m] = month.split("-")
  const monthLabel = new Date(Number(year), Number(m) - 1, 1)
    .toLocaleDateString("pt-PT", { month: "long", year: "numeric" })

  const content = `
    <h2 style="color:#1a1a2e;margin:0 0 8px;font-size:20px;">Pagamento Confirmado</h2>
    <p style="color:#666;margin:0 0 24px;">Olá ${consultantName}, o teu pagamento foi recebido com sucesso. Obrigado!</p>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin-bottom:24px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="color:#666;padding:6px 0;font-size:14px;width:40%;">Mês</td><td style="color:#1a1a2e;padding:6px 0;font-size:14px;font-weight:600;">${monthLabel}</td></tr>
        <tr><td style="color:#666;padding:6px 0;font-size:14px;">Total pago</td><td style="color:#16a34a;padding:6px 0;font-size:18px;font-weight:700;">${formatAmount(total)}</td></tr>
      </table>
    </div>

    <a href="${APP_URL}/consultant/payments" style="display:inline-block;background:#0f3460;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">Ver Pagamentos</a>
  `

  const result = await getResend().emails.send({
    from: FROM,
    to: consultantEmail,
    subject: `✅ Pagamento confirmado — ${monthLabel} · ${formatAmount(total)}`,
    html: emailBase(content),
  })
  console.log(`[email] sendInvoicePaidConfirmationEmail → ${consultantEmail}`, result)
  return result
}

export async function sendInvoicePaidEmail({
  consultantName,
  consultantEmail,
  month,
  total,
  invoiceId,
}: {
  consultantName: string
  consultantEmail: string
  month: string
  total: number
  invoiceId: string
}) {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL
  if (!adminEmail) return

  const [year, m] = month.split("-")
  const monthLabel = new Date(Number(year), Number(m) - 1, 1)
    .toLocaleDateString("pt-PT", { month: "long", year: "numeric" })

  const content = `
    <h2 style="color:#1a1a2e;margin:0 0 8px;font-size:20px;">Fatura Paga</h2>
    <p style="color:#666;margin:0 0 24px;">Um consultor acabou de pagar a sua fatura mensal.</p>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin-bottom:24px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="color:#666;padding:6px 0;font-size:14px;width:40%;">Consultor</td><td style="color:#1a1a2e;padding:6px 0;font-size:14px;font-weight:600;">${consultantName} <span style="color:#999;font-weight:400;">(${consultantEmail})</span></td></tr>
        <tr><td style="color:#666;padding:6px 0;font-size:14px;">Mês</td><td style="color:#1a1a2e;padding:6px 0;font-size:14px;font-weight:600;">${monthLabel}</td></tr>
        <tr><td style="color:#666;padding:6px 0;font-size:14px;">Total pago</td><td style="color:#16a34a;padding:6px 0;font-size:18px;font-weight:700;">${formatAmount(total)}</td></tr>
      </table>
    </div>

    <a href="${APP_URL}/admin/invoices/${invoiceId}" style="display:inline-block;background:#0f3460;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">Ver Fatura</a>
  `

  const result = await getResend().emails.send({
    from: FROM,
    to: adminEmail,
    subject: `✅ Fatura paga — ${consultantName} · ${monthLabel} · ${formatAmount(total)}`,
    html: emailBase(content),
  })
  console.log(`[email] sendInvoicePaidEmail → ${adminEmail}`, result)
  return result
}

export async function sendPaymentReminderEmail({
  consultantName,
  consultantEmail,
  month,
  total,
  dueDate,
  invoiceId,
}: {
  consultantName: string
  consultantEmail: string
  month: string
  total: number
  dueDate: Date | null
  invoiceId: string
}) {
  const [year, m] = month.split("-")
  const monthLabel = new Date(Number(year), Number(m) - 1, 1)
    .toLocaleDateString("pt-PT", { month: "long", year: "numeric" })

  const dueDateStr = dueDate
    ? new Date(dueDate).toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" })
    : null

  const content = `
    <h2 style="color:#1a1a2e;margin:0 0 8px;font-size:20px;">Fatura por Pagar — ${monthLabel}</h2>
    <p style="color:#666;margin:0 0 24px;">
      Olá ${consultantName},<br/><br/>
      Existe uma fatura pendente de pagamento referente a ${monthLabel}. Por favor regularize o pagamento o mais brevemente possível.
    </p>

    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:20px;margin-bottom:24px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="color:#666;padding:6px 0;font-size:14px;width:40%;">Mês</td><td style="color:#1a1a2e;padding:6px 0;font-size:14px;font-weight:600;">${monthLabel}</td></tr>
        <tr><td style="color:#666;padding:6px 0;font-size:14px;">Valor em dívida</td><td style="color:#b45309;padding:6px 0;font-size:20px;font-weight:700;">${formatAmount(total)}</td></tr>
        ${dueDateStr ? `<tr><td style="color:#666;padding:6px 0;font-size:14px;">Data de vencimento</td><td style="color:#92400e;padding:6px 0;font-size:14px;font-weight:600;">${dueDateStr}</td></tr>` : ""}
      </table>
    </div>

    <p style="color:#666;font-size:14px;margin:0 0 24px;">
      Pode pagar diretamente na plataforma em <strong>Pagamentos</strong>, onde também encontra o detalhe completo dos serviços incluídos nesta fatura.
    </p>

    <a href="${APP_URL}/consultant/payments/${invoiceId}" style="display:inline-block;background:#0f3460;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600;">
      Pagar agora →
    </a>

    <p style="color:#aaa;font-size:12px;margin-top:32px;">
      Se já efectuou o pagamento recentemente, por favor ignore este email. Em caso de dúvida contacte o administrador.
    </p>
  `

  const result = await getResend().emails.send({
    from: FROM,
    to: consultantEmail,
    subject: `⚠️ Fatura por pagar — ${monthLabel} · ${formatAmount(total)}`,
    html: emailBase(content),
  })
  console.log(`[email] sendPaymentReminderEmail → ${consultantEmail}`, result)
  return result
}

export async function sendStatusUpdateEmail(
  data: BookingEmailData,
  to: "consultant" | "videographer",
  customMessage?: string,
  icsContent?: string
) {
  const recipient =
    to === "consultant"
      ? { email: data.consultantEmail, name: data.consultantName }
      : { email: data.videographerEmail, name: data.videographerName }

  const statusMessages: Partial<Record<BookingStatus, string>> = {
    ACCEPTED: "A sua marcação foi aceite pelo videógrafo.",
    REJECTED:
      "A sua marcação foi recusada pelo videógrafo. Por favor, faça uma nova marcação.",
    CANCELLED: "A marcação foi cancelada.",
    FILE_DELIVERED: "O conteúdo final foi entregue e está disponível para download.",
    COMPLETED: "O serviço foi marcado como concluído.",
  }

  const message = customMessage || statusMessages[data.status] || "O estado da sua marcação foi atualizado."

  const content = `
    <h2 style="color:#1a1a2e;margin:0 0 8px;font-size:20px;">Atualização da Marcação</h2>
    <p style="color:#666;margin:0 0 24px;">${message}</p>

    <div style="background:#f8f9fa;border-radius:8px;padding:20px;margin-bottom:24px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="color:#666;padding:6px 0;font-size:14px;width:40%;">Data e Hora</td><td style="color:#1a1a2e;padding:6px 0;font-size:14px;font-weight:600;">${formatDate(data.scheduledAt)}</td></tr>
        <tr><td style="color:#666;padding:6px 0;font-size:14px;">Imóvel</td><td style="color:#1a1a2e;padding:6px 0;font-size:14px;font-weight:600;">${data.propertyAddress}${data.propertyType ? ` <span style="color:#666;font-weight:400;">(${formatPropertyType(data.propertyType)})</span>` : ""}</td></tr>
      </table>
    </div>

    <a href="${APP_URL}/consultant/bookings/${data.bookingId}" style="display:inline-block;background:#0f3460;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">Ver Detalhes</a>
  `

  await getResend().emails.send({
    from: FROM,
    to: recipient.email,
    subject: `Atualização — ${formatDate(data.scheduledAt)}`,
    html: emailBase(content),
    ...(icsContent
      ? {
          attachments: [
            {
              filename: "marcacao.ics",
              content: Buffer.from(icsContent).toString("base64"),
            },
          ],
        }
      : {}),
  })
}
