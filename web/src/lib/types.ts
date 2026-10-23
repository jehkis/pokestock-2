export const KATEGORIAT = ['Kiilto', 'Tähti', 'Trainer', 'Erikois', 'Vanhat', 'Pienet sarjat', 'Bulk'] as const;
export const CATS = ['Kaikki', ...KATEGORIAT] as const;
export const KUNNOT = ['NM/M', 'EX', 'LP', 'PL', 'DMG'] as const;

export interface Card {
  _id: string;
  nimi: string;
  numero?: string;
  kategoria: string;
  kunto?: string;
  arvo: number;
  myyty?: { tila: boolean; pvm: string | null; hinta: number | null; ostaja: string };
  tarjottu?: boolean;
}

export interface Tarjous {
  _id: string;
  kortti_id: Pick<Card, '_id' | 'nimi' | 'numero' | 'kategoria' | 'arvo'> | null;
  ostajan_nimi: string;
  ostajan_sahkoposti: string;
  ostajan_viesti?: string;
  tarjottu_hinta: number;
  tila: 'odottaa' | 'hyvaksytty' | 'hylatty';
}
