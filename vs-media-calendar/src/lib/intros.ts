// Helpers partilhados das intros de consultores.
// Puro — sem acesso a base de dados — para poder ser usado em qualquer página.

export const BACKFILL_INTRO_PREFIX = "backfill:"
export const MANUAL_INTRO_PREFIX = "manual:intro:"

/**
 * Intros registadas à mão (backfill de junho/julho ou adicionadas pelo admin)
 * não têm ficheiro de vídeo real — não devem oferecer download nem expirar.
 */
export function isPlaceholderIntro(fileUrl: string): boolean {
  return fileUrl.startsWith(BACKFILL_INTRO_PREFIX) || fileUrl.startsWith(MANUAL_INTRO_PREFIX)
}

export interface IntroShare {
  secondConsultantId: string | null
  thirdConsultantId: string | null
  fourthConsultantId: string | null
}

/** Número de consultores que partilham a intro (1 a 4). */
export function introSplitCount(d: IntroShare): number {
  return 1 + (d.secondConsultantId ? 1 : 0) + (d.thirdConsultantId ? 1 : 0) + (d.fourthConsultantId ? 1 : 0)
}

/** Valor s/ IVA que cabe a cada consultor: preço da intro ÷ nº de consultores. */
export function introNetPrice(d: IntroShare, introPrice: number): number {
  return Math.round((introPrice / introSplitCount(d)) * 100) / 100
}
