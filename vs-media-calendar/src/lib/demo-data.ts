// Mock data for demo/preview mode — no database required

export type DemoBookingStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "PENDING_ACCEPTANCE"
  | "ACCEPTED"
  | "REJECTED"
  | "CANCELLED"
  | "IN_PROGRESS"
  | "FILE_DELIVERED"
  | "COMPLETED"

export interface DemoBooking {
  id: string
  status: DemoBookingStatus
  scheduledAt: string
  propertyAddress: string
  consultantName: string
  consultantEmail: string
  videographerName: string
  services: string[]
  amount: number
  hasTravelFee: boolean
  hasDeliverables: boolean
  notes?: string
  createdAt: string
}

export const DEMO_STATUS_LABELS: Record<DemoBookingStatus, string> = {
  PENDING_PAYMENT: "Aguarda Pagamento",
  PAID: "Paga",
  PENDING_ACCEPTANCE: "Aguarda Aceitação",
  ACCEPTED: "Aceite",
  REJECTED: "Recusada",
  CANCELLED: "Cancelada",
  IN_PROGRESS: "Em Execução",
  FILE_DELIVERED: "Ficheiro Entregue",
  COMPLETED: "Concluída",
}

export const DEMO_STATUS_COLORS: Record<DemoBookingStatus, string> = {
  PENDING_PAYMENT: "bg-amber-100 text-amber-800",
  PAID: "bg-blue-100 text-blue-800",
  PENDING_ACCEPTANCE: "bg-purple-100 text-purple-800",
  ACCEPTED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-100 text-gray-600",
  IN_PROGRESS: "bg-cyan-100 text-cyan-800",
  FILE_DELIVERED: "bg-indigo-100 text-indigo-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
}

export const DEMO_BOOKINGS: DemoBooking[] = [
  {
    id: "demo-1",
    status: "PENDING_ACCEPTANCE",
    scheduledAt: "2026-04-18T10:00:00",
    propertyAddress: "Rua das Flores, 45, 1200-192 Lisboa",
    consultantName: "Ana Silva",
    consultantEmail: "ana.silva@agencia.pt",
    videographerName: "Eduardo Justino",
    services: ["Vídeo Standard", "Fotografia T1/T2"],
    amount: 75,
    hasTravelFee: false,
    hasDeliverables: false,
    notes: "Apartamento recém renovado com vistas para o Tejo. Porteiro disponível das 9h às 18h.",
    createdAt: "2026-04-14T09:00:00",
  },
  {
    id: "demo-2",
    status: "ACCEPTED",
    scheduledAt: "2026-04-22T14:30:00",
    propertyAddress: "Av. da Liberdade, 110, 3.º Dto, 1250-146 Lisboa",
    consultantName: "João Ferreira",
    consultantEmail: "joao.ferreira@agencia.pt",
    videographerName: "Tomás Almeida",
    services: ["Vídeo Standard + Drone"],
    amount: 110,
    hasTravelFee: true,
    hasDeliverables: false,
    notes: "Moradia com jardim e piscina. Acesso pela portaria principal.",
    createdAt: "2026-04-12T15:30:00",
  },
  {
    id: "demo-3",
    status: "FILE_DELIVERED",
    scheduledAt: "2026-04-10T09:00:00",
    propertyAddress: "Rua Garrett, 23, 2.º Esq, 1200-204 Lisboa",
    consultantName: "Maria Santos",
    consultantEmail: "maria.santos@agencia.pt",
    videographerName: "Eduardo Justino",
    services: ["Vídeo Standard", "Fotografia T3/T4"],
    amount: 85,
    hasTravelFee: false,
    hasDeliverables: true,
    createdAt: "2026-04-05T11:00:00",
  },
  {
    id: "demo-4",
    status: "COMPLETED",
    scheduledAt: "2026-03-28T11:00:00",
    propertyAddress: "Rua da Madalena, 88, 1100-323 Lisboa",
    consultantName: "Ana Silva",
    consultantEmail: "ana.silva@agencia.pt",
    videographerName: "Bernardo Pavão",
    services: ["Fotografia T1/T2"],
    amount: 25,
    hasTravelFee: false,
    hasDeliverables: true,
    createdAt: "2026-03-20T14:00:00",
  },
  {
    id: "demo-5",
    status: "COMPLETED",
    scheduledAt: "2026-03-15T10:00:00",
    propertyAddress: "Trav. do Carmo, 12, 1200-092 Lisboa",
    consultantName: "Ricardo Lima",
    consultantEmail: "ricardo.lima@agencia.pt",
    videographerName: "Eduardo Justino",
    services: ["Vídeo Standard + Drone", "Fotografia Drone"],
    amount: 145,
    hasTravelFee: true,
    hasDeliverables: true,
    createdAt: "2026-03-10T10:00:00",
  },
  {
    id: "demo-6",
    status: "CANCELLED",
    scheduledAt: "2026-04-08T13:00:00",
    propertyAddress: "Av. Almirante Reis, 205, 1000-045 Lisboa",
    consultantName: "Ana Silva",
    consultantEmail: "ana.silva@agencia.pt",
    videographerName: "Tomás Almeida",
    services: ["Fotografia T3/T4"],
    amount: 35,
    hasTravelFee: false,
    hasDeliverables: false,
    createdAt: "2026-04-01T09:00:00",
  },
  {
    id: "demo-7",
    status: "IN_PROGRESS",
    scheduledAt: "2026-04-14T09:00:00",
    propertyAddress: "Largo de Santos, 4, 1200-808 Lisboa",
    consultantName: "Carla Mendes",
    consultantEmail: "carla.mendes@agencia.pt",
    videographerName: "Bernardo Pavão",
    services: ["Vídeo Standard"],
    amount: 50,
    hasTravelFee: false,
    hasDeliverables: false,
    createdAt: "2026-04-08T10:00:00",
  },
  {
    id: "demo-8",
    status: "PENDING_ACCEPTANCE",
    scheduledAt: "2026-04-25T08:00:00",
    propertyAddress: "R. Actor Taborda, 72, 1900-011 Lisboa",
    consultantName: "Ana Silva",
    consultantEmail: "ana.silva@agencia.pt",
    videographerName: "Eduardo Justino",
    services: ["Fotografia T5+"],
    amount: 45,
    hasTravelFee: false,
    hasDeliverables: false,
    createdAt: "2026-04-13T16:00:00",
  },
]

// Ana Silva's bookings (used in consultant demo)
export const DEMO_CONSULTANT_BOOKINGS = DEMO_BOOKINGS.filter(
  (b) => b.consultantName === "Ana Silva"
)

// Eduardo Justino's bookings (used in videographer demo)
export const DEMO_VIDEOGRAPHER_BOOKINGS = DEMO_BOOKINGS.filter(
  (b) => b.videographerName === "Eduardo Justino"
)

export const DEMO_USERS = [
  { id: "u1", name: "Ana Silva", email: "ana.silva@agencia.pt", role: "CONSULTANT", active: true, createdAt: "2026-01-10" },
  { id: "u2", name: "João Ferreira", email: "joao.ferreira@agencia.pt", role: "CONSULTANT", active: true, createdAt: "2026-01-15" },
  { id: "u3", name: "Maria Santos", email: "maria.santos@agencia.pt", role: "CONSULTANT", active: true, createdAt: "2026-02-01" },
  { id: "u4", name: "Ricardo Lima", email: "ricardo.lima@agencia.pt", role: "CONSULTANT", active: true, createdAt: "2026-02-10" },
  { id: "u5", name: "Carla Mendes", email: "carla.mendes@agencia.pt", role: "CONSULTANT", active: false, createdAt: "2026-01-20" },
  { id: "vid1", name: "Eduardo Justino", email: "eduardo@vsmedia.pt", role: "VIDEOGRAPHER", active: true, createdAt: "2025-12-01" },
  { id: "vid2", name: "Tomás Almeida", email: "tomas@vsmedia.pt", role: "VIDEOGRAPHER", active: true, createdAt: "2025-12-01" },
  { id: "vid3", name: "Bernardo Pavão", email: "bernardo@vsmedia.pt", role: "VIDEOGRAPHER", active: true, createdAt: "2025-12-01" },
  { id: "a1", name: "Admin VS.Media", email: "admin@vsmedia.pt", role: "ADMIN", active: true, createdAt: "2025-11-01" },
]

export const DEMO_PRICING = [
  { service: "Vídeo Standard", price: 50, description: "Vídeo profissional interior" },
  { service: "Vídeo Standard + Drone", price: 60, description: "Vídeo com cobertura aérea" },
  { service: "Intro Adicional", price: 25, description: "Por cada intro extra" },
  { service: "Fotografia T1/T2", price: 25, description: "Tipologia pequena" },
  { service: "Fotografia T3/T4", price: 35, description: "Tipologia média" },
  { service: "Fotografia T5+", price: 45, description: "Tipologia grande" },
  { service: "Fotografia Drone", price: 35, description: "Vistas aéreas exteriores" },
  { service: "Taxa de Deslocação", price: 50, description: "Se >1h do centro de Odivelas" },
]
