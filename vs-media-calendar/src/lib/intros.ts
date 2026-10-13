// Helpers partilhados das intros de consultores.
// Puro — sem acesso a base de dados — para poder ser usado em qualquer página.

export const BACKFILL_INTRO_PREFIX = "backfill:"
export const MANUAL_INTRO_PREFIX = "manual:intro:"

/** Nº máximo de consultores que podem partilhar a mesma intro. */
export const MAX_INTRO_CONSULTANTS = 6

/**
 * Colunas de consultor no Deliverable, por ordem. Centralizado aqui para que
 * aumentar o limite seja uma alteração num sítio só.
 */
export const INTRO_CONSULTANT_FIELDS = [
  "targetConsultantId",
  "secondConsultantId",
  "thirdConsultantId",
  "fourthConsultantId",
  "fifthConsultantId",
  "sixthConsultantId",
] as const

export const INTRO_CONSULTANT_RELATIONS = [
  "targetConsultant",
  "secondConsultant",
  "thirdConsultant",
  "fourthConsultant",
  "fifthConsultant",
  "sixthConsultant",
] as const

/** Cláusula `OR` do Prisma para encontrar intros de um consultor em qualquer posição. */
export function introConsultantFilter(consultantId: string) {
  return INTRO_CONSULTANT_FIELDS.map((field) => ({ [field]: consultantId })) as
    Record<(typeof INTRO_CONSULTANT_FIELDS)[number], string>[]
}

/** `select` do Prisma com todas as colunas de consultor. */
export const introConsultantSelect = Object.fromEntries(
  INTRO_CONSULTANT_FIELDS.map((f) => [f, true])
) as Record<(typeof INTRO_CONSULTANT_FIELDS)[number], true>

/** Mapeia uma lista de ids de consultor para as colunas do Deliverable. */
export function introConsultantData(ids: string[]) {
  return Object.fromEntries(
    INTRO_CONSULTANT_FIELDS.map((field, i) => [field, ids[i] ?? null])
  ) as Record<(typeof INTRO_CONSULTANT_FIELDS)[number], string | null>
}

/**
 * Intros registadas à mão (backfill de junho/julho ou adicionadas pelo admin)
 * não têm ficheiro de vídeo real — não devem oferecer download nem expirar.
 */
export function isPlaceholderIntro(fileUrl: string): boolean {
  return fileUrl.startsWith(BACKFILL_INTRO_PREFIX) || fileUrl.startsWith(MANUAL_INTRO_PREFIX)
}

export type IntroShare = Partial<Record<(typeof INTRO_CONSULTANT_FIELDS)[number], string | null>>

/** Número de consultores que partilham a intro (1 a MAX_INTRO_CONSULTANTS). */
export function introSplitCount(d: IntroShare): number {
  // targetConsultantId conta sempre como 1, mesmo em registos antigos onde
  // só ele está preenchido
  const extras = INTRO_CONSULTANT_FIELDS.slice(1).filter((f) => d[f]).length
  return 1 + extras
}

/** Valor s/ IVA que cabe a cada consultor: preço da intro ÷ nº de consultores. */
export function introNetPrice(d: IntroShare, introPrice: number): number {
  return Math.round((introPrice / introSplitCount(d)) * 100) / 100
}
