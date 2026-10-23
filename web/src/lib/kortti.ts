// Kaupan korttiruutu, korttisivun osoite ja kallistusefekti (kauppa- ja korttisivu)
import { escapeHtml, eur } from './format';
import type { Card } from './types';

const slug = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// /kortti/<mongo-id>-<nimi>; sivu lukee id:n alusta, nimi on vain luettavuutta ja jakamista varten
export const korttiUrl = (c: Pick<Card, '_id' | 'nimi'>) => `/kortti/${c._id}-${slug(c.nimi)}`;

// TCGdex: low.webp ruudukkoon, high.webp korttisivulle
export const isoKuva = (kuva: string) => kuva.replace(/\/low\.webp$/, '/high.webp');

export const kuvaPuuttuu = '<div class="kuva-puuttuu"><div class="pallo"></div><small>Ei kuvaa</small></div>';

export function tile(c: Card) {
  const url = korttiUrl(c);
  const kuva = c.kuva
    ? `<img src="${escapeHtml(c.kuva)}" alt="${escapeHtml(c.nimi)}" loading="lazy" decoding="async">`
    : kuvaPuuttuu;
  return `
    <article class="cardtile${c.tarjottu ? ' tarjottu' : ''}" data-kat="${escapeHtml(c.kategoria)}">
      <a class="kuva-wrap" href="${url}" aria-label="${escapeHtml(c.nimi)}">
        ${kuva}
        <div class="holo"></div>
        ${c.tarjottu ? '<span class="tarjottu-nauha">Tarjous käsittelyssä</span>' : ''}
      </a>
      <div class="tiedot">
        <span class="kat-badge">${escapeHtml(c.kategoria)}</span>
        <h3 class="nimi"><a href="${url}">${escapeHtml(c.nimi)}</a></h3>
        <div class="numero">${escapeHtml(c.numero || '–')} · ${escapeHtml(c.kunto || '')}</div>
        <div class="ala">
          <span class="hinta">${eur(c.arvo)}</span>
          ${c.tarjottu
            ? `<button class="btn secondary small" disabled>Varattu</button>`
            : `<button class="btn small" data-open-offer="${c._id}">Tee tarjous</button>`}
        </div>
      </div>
    </article>`;
}

const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// 3D-kallistus ja valoheijastus hiiren mukaan; kuva, jota ei saatu ladattua, korvataan paikkamerkillä
export function elavoita(root: ParentNode) {
  root.querySelectorAll<HTMLImageElement>('.kuva-wrap img').forEach((img) =>
    img.addEventListener('error', () => { img.outerHTML = kuvaPuuttuu; }, { once: true }));
  if (reduceMotion()) return;
  root.querySelectorAll<HTMLElement>('.kuva-wrap').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      el.style.setProperty('--ry', `${(x - 0.5) * 16}deg`);
      el.style.setProperty('--rx', `${(0.5 - y) * 16}deg`);
      el.style.setProperty('--mx', `${x * 100}%`);
      el.style.setProperty('--my', `${y * 100}%`);
    });
    el.addEventListener('pointerleave', () => {
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
    });
  });
}
