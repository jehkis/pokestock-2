import { CATS, type Card } from './types';

export function renderTabs(el: HTMLElement, cards: Card[], active: string, onSelect: (cat: string) => void) {
  el.innerHTML = '';
  CATS.forEach((cat) => {
    const count = cat === 'Kaikki' ? cards.length : cards.filter((c) => c.kategoria === cat).length;
    const tab = document.createElement('div');
    tab.className = 'tab';
    tab.setAttribute('data-active', String(cat === active));
    tab.innerHTML = `${cat}<span class="n">${count}</span>`;
    tab.addEventListener('click', () => onSelect(cat));
    el.appendChild(tab);
  });
}

export function filterCards(cards: Card[], category: string, search: string) {
  let list = cards.slice();
  if (category !== 'Kaikki') list = list.filter((c) => c.kategoria === category);
  if (search) {
    const q = search.toLowerCase();
    list = list.filter((c) => c.nimi.toLowerCase().includes(q) || (c.numero || '').toLowerCase().includes(q));
  }
  return list;
}
