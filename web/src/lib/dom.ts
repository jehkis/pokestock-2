export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

type ListState = 'loading' | 'empty' | 'error' | 'none';

// Vaihtaa ListStates-komponentin tilaviestin (lataus / tyhja / virhe / ei mitaan).
export function showState(state: ListState, errorText = '') {
  $('loadingState').style.display = state === 'loading' ? 'block' : 'none';
  $('emptyState').style.display = state === 'empty' ? 'block' : 'none';
  const es = $('errorState');
  es.style.display = state === 'error' ? 'block' : 'none';
  if (state === 'error') es.textContent = errorText;
}

// Modal-komponentin avaus/sulku; sulkeutuu myos taustaa klikkaamalla.
export function setupModal(id: string) {
  const overlay = $(id);
  const close = () => overlay.setAttribute('data-open', 'false');
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  return { open: () => overlay.setAttribute('data-open', 'true'), close };
}
