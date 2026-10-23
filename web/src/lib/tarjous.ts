import { apiRequest } from './api';
import { $, setupModal } from './dom';
import { eur } from './format';
import type { Card } from './types';

type Kortti = Pick<Card, '_id' | 'nimi' | 'numero' | 'arvo'>;

// TarjousModal-komponentin logiikka. Palauttaa avaa(kortti); onSent ajetaan onnistuneen tarjouksen jälkeen.
export function setupTarjous(onSent: (kortti: Kortti) => void | Promise<void>) {
  const modal = setupModal('offerModal');
  const form = $<HTMLFormElement>('offerForm');
  let valittu: Kortti | null = null;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!valittu) return;
    const errEl = $('formError');
    const okEl = $('formOk');
    errEl.style.display = 'none';
    const submitBtn = $<HTMLButtonElement>('submitBtn');
    submitBtn.disabled = true;

    const payload = {
      ostajan_nimi: $<HTMLInputElement>('f_nimi').value.trim(),
      ostajan_sahkoposti: $<HTMLInputElement>('f_email').value.trim(),
      tarjottu_hinta: parseFloat($<HTMLInputElement>('f_hinta').value) || 0,
      ostajan_viesti: $<HTMLTextAreaElement>('f_viesti').value.trim(),
    };

    try {
      await apiRequest(`/api/cards/${valittu._id}/tarjous`, { method: 'POST', body: JSON.stringify(payload) });
      form.style.display = 'none';
      okEl.textContent = 'Tarjous lähetetty! Myyjä ottaa sinuun yhteyttä sähköpostitse jos tarjous hyväksytään.';
      okEl.style.display = 'block';
      await onSent(valittu);
    } catch (err) {
      errEl.textContent = (err as Error).message;
      errEl.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
    }
  });

  return function avaa(kortti: Kortti) {
    valittu = kortti;
    $('offerModalSub').textContent = `${kortti.nimi} ${kortti.numero || ''} · ${eur(kortti.arvo)}`.trim();
    form.reset();
    $('formError').style.display = 'none';
    $('formOk').style.display = 'none';
    form.style.display = 'block';
    modal.open();
  };
}
