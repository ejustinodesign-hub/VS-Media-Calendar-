// Corre com: DATABASE_URL=<base de testes> npm run test:charges
// NUNCA apontar para a base de produção — o teste cria dados.
// Testa o ciclo de vida da cobrança vídeo a vídeo contra uma base real.
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { syncBookingCharge, syncIntroCharges, overdueChargeCount } from "../src/lib/charges"
import { getDeliverableAccess } from "../src/lib/deliverable-access"

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })

let pass = 0, fail = 0
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  ok ? pass++ : fail++
  console.log(`${ok ? "PASS " : "FALHA"}  ${label.padEnd(52)} ${ok ? "" : `obtido=${JSON.stringify(actual)} esperado=${JSON.stringify(expected)}`}`)
}

async function main() {
  const vg = await prisma.user.create({ data: { name: "Pavao", email: "v@t.pt", role: "VIDEOGRAPHER" } })
  const c1 = await prisma.user.create({ data: { name: "Ana", email: "a@t.pt", role: "CONSULTANT" } })
  const c2 = await prisma.user.create({ data: { name: "Bruno", email: "b@t.pt", role: "CONSULTANT" } })
  const c3 = await prisma.user.create({ data: { name: "Carla", email: "c@t.pt", role: "CONSULTANT" } })

  // Marcação aceite mas ainda sem vídeo entregue
  const b = await prisma.booking.create({
    data: {
      consultantId: c1.id, videographerId: vg.id, status: "ACCEPTED",
      scheduledAt: new Date(), propertyAddress: "Rua A", paymentType: "FLAT_FEE",
      hasTravelFee: true, travelFeeAmount: 50,
      services: { create: [{ serviceType: "VIDEO_STANDARD", price: 100 }] },
    },
  })

  check("não entregue → sem cobrança", await syncBookingCharge(b.id), null)

  // Entregue → cobrança de 150€ s/IVA (100 vídeo + 50 deslocação)
  await prisma.booking.update({ where: { id: b.id }, data: { status: "FILE_DELIVERED" } })
  const ch = await syncBookingCharge(b.id)
  check("entregue → cobrança criada (s/IVA)", ch?.netAmount, 150)
  check("entregue → cobrança criada (c/IVA)", ch?.totalAmount, 184.5)

  // Correr outra vez não duplica
  await syncBookingCharge(b.id)
  check("sincronizar 2x não duplica", await prisma.charge.count({ where: { bookingId: b.id } }), 1)

  // Alterar serviços actualiza o valor
  await prisma.booking.update({ where: { id: b.id }, data: { hasTravelFee: false, travelFeeAmount: 0 } })
  check("remover deslocação actualiza valor", (await syncBookingCharge(b.id))?.netAmount, 100)

  // Ficheiro do vídeo + acesso antes de pagar
  const file = await prisma.deliverable.create({
    data: { bookingId: b.id, fileName: "v.mp4", fileUrl: "https://public.blob.vercel-storage.com/v.mp4", uploadedBy: vg.id },
  })
  const before = await getDeliverableAccess(file.id, { id: c1.id, role: "CONSULTANT" })
  check("por pagar → download bloqueado", [before.canView, before.canDownload, before.reason], [true, false, "unpaid"])

  // Pagar
  await prisma.charge.updateMany({ where: { bookingId: b.id }, data: { status: "PAID", paidAt: new Date() } })
  const after = await getDeliverableAccess(file.id, { id: c1.id, role: "CONSULTANT" })
  check("pago → download permitido", [after.canDownload, after.reason], [true, "ok"])

  // Cobrança paga não é alterada por nova sincronização
  await prisma.booking.update({ where: { id: b.id }, data: { hasTravelFee: true, travelFeeAmount: 50 } })
  check("cobrança paga não muda de valor", (await syncBookingCharge(b.id))?.netAmount, 100)

  // Intro partilhada por 3 → 8,33€ cada
  const intro = await prisma.deliverable.create({
    data: {
      bookingId: b.id, fileName: "i.mp4", fileUrl: "https://public.blob.vercel-storage.com/i.mp4",
      uploadedBy: vg.id, description: "Intro — Rua A",
      targetConsultantId: c2.id, secondConsultantId: c3.id, thirdConsultantId: c1.id,
    },
  })
  const introCharges = await syncIntroCharges(intro.id)
  check("intro ÷3 → 3 cobranças", introCharges.length, 3)
  check("intro ÷3 → 8,33€ cada", introCharges[0].netAmount, 8.33)

  // Retirar um consultor da partilha
  await prisma.deliverable.update({ where: { id: intro.id }, data: { thirdConsultantId: null } })
  const reshared = await syncIntroCharges(intro.id)
  check("retirar consultor → 2 cobranças", reshared.length, 2)
  check("retirar consultor → 12,50€ cada", reshared[0].netAmount, 12.5)
  check("cobrança do removido desaparece", await prisma.charge.count({ where: { deliverableId: intro.id } }), 2)

  // Download da intro bloqueado até pagar
  const introAccess = await getDeliverableAccess(intro.id, { id: c2.id, role: "CONSULTANT" })
  check("intro por pagar → bloqueada", introAccess.canDownload, false)

  // Videógrafo e admin passam sempre
  check("videógrafo descarrega", (await getDeliverableAccess(intro.id, { id: vg.id, role: "VIDEOGRAPHER" })).canDownload, true)
  check("admin descarrega", (await getDeliverableAccess(intro.id, { id: "x", role: "ADMIN" })).canDownload, true)

  // Consultor sem ligação ao ficheiro não vê nada
  const stranger = await prisma.user.create({ data: { name: "Z", email: "z@t.pt", role: "CONSULTANT" } })
  check("consultor alheio não acede", (await getDeliverableAccess(intro.id, { id: stranger.id, role: "CONSULTANT" })).canView, false)

  // Comissão nunca bloqueia
  const bc = await prisma.booking.create({
    data: {
      consultantId: c2.id, videographerId: vg.id, status: "FILE_DELIVERED",
      scheduledAt: new Date(), propertyAddress: "Rua C", paymentType: "COMMISSION",
      services: { create: [{ serviceType: "VIDEO_STANDARD", price: 100 }] },
    },
  })
  check("comissão → sem cobrança", await syncBookingCharge(bc.id), null)
  const fc = await prisma.deliverable.create({
    data: { bookingId: bc.id, fileName: "c.mp4", fileUrl: "https://public.blob.vercel-storage.com/c.mp4", uploadedBy: vg.id },
  })
  check("comissão → download livre", (await getDeliverableAccess(fc.id, { id: c2.id, role: "CONSULTANT" })).canDownload, true)

  // Bloqueio de marcações só depois de 30 dias
  check("cobrança recente não bloqueia", await overdueChargeCount(c2.id), 0)
  await prisma.charge.updateMany({
    where: { consultantId: c2.id, status: "PENDING" },
    data: { createdAt: new Date(Date.now() - 40 * 86400000) },
  })
  check("cobrança com 40 dias bloqueia", (await overdueChargeCount(c2.id)) > 0, true)

  // Passar a comissão remove a cobrança por pagar
  const b2 = await prisma.booking.create({
    data: {
      consultantId: c3.id, videographerId: vg.id, status: "FILE_DELIVERED",
      scheduledAt: new Date(), propertyAddress: "Rua D", paymentType: "FLAT_FEE",
      services: { create: [{ serviceType: "VIDEO_STANDARD", price: 100 }] },
    },
  })
  await syncBookingCharge(b2.id)
  await prisma.booking.update({ where: { id: b2.id }, data: { paymentType: "COMMISSION" } })
  await syncBookingCharge(b2.id)
  check("passar a comissão remove cobrança", await prisma.charge.count({ where: { bookingId: b2.id } }), 0)

  console.log(`\n${pass} passaram, ${fail} falharam`)
  process.exit(fail === 0 ? 0 : 1)
}
main()
