export const eur = (n: number) => Number(n).toLocaleString('fi-FI', { style: 'currency', currency: 'EUR' });

export const escapeHtml = (s: unknown) =>
  String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]!);

export const cardmarketUrl = (nimi: string) =>
  `https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=${encodeURIComponent(nimi)}`;
