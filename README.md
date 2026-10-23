# PokeStock 2.0

PokeStockin full stack -versio, jonka frontend on tehty uudelleen
[Astrolla](https://astro.build). Alkuperäinen versio on edelleen
repossa `pokestock_repo` (`fullstack/`), eikä siihen ole koskettu.

## Mikä muuttui 1.0 → 2.0

| | 1.0 | 2.0 |
|---|---|---|
| Frontend | Kaksi isoa HTML-tiedostoa (`public/index.html`, `admin.html`), CSS ja JS samassa tiedostossa | Astro-projekti `web/`: yhteinen layout, komponentit ja TypeScript-moduulit |
| Yhteinen koodi | Kopioitu kumpaankin sivuun (tyylit, `eur`, `escapeHtml`, välilehdet, haku) | Kerran: `src/styles/global.css` ja `src/lib/` |
| Tyypit | Ei | `Card`, `Tarjous` (`src/lib/types.ts`); `npm run check` |
| Rajapinta | Express + MongoDB | Sama, kopioitu sellaisenaan (`api/`) |
| Docker | API-image tarjoili `public/`-kansion | Monivaiheinen build: Astro buildataan ja dist kopioidaan API-imageen |

Ylläpitosivun osoite on nyt `/admin` (ennen `/admin.html`).

## Kansiorakenne

```
api/                   Express REST API (sama kuin 1.0, ks. pokestock_repo/fullstack/README.md)
web/                   Astro-frontend
  src/layouts/Layout.astro      <head>, fontit, globaalit tyylit
  src/components/               Brand, CategoryTabs, ListStates, Modal
  src/lib/                      api.ts, dom.ts, format.ts, tabs.ts, types.ts
  src/pages/index.astro         julkinen kauppa  (/)
  src/pages/admin.astro         ylläpito         (/admin)
  src/styles/global.css
Dockerfile             web-build + api samaan imageen
docker-compose.yml     Mongo + sovellus
```

## Kehitys

Kaksi terminaalia:

```bash
# 1) rajapinta (tarvitsee MongoDB:n, esim. docker compose up -d mongo)
cd api && npm install && cp .env.example .env && npm run dev

# 2) frontend, http://localhost:4321 (välittää /api-kutsut portille 3000)
cd web && npm install && npm run dev
```

## Docker

```bash
cp api/.env.example api/.env   # täytä ADMIN_KEY (+ Gmail, jos haluat sähköpostit)
docker compose up -d --build
docker compose exec api npm run seed    # 265 korttia, kerran
```

- Kauppa: http://localhost:3000
- Ylläpito: http://localhost:3000/admin

## Testit

```bash
cd api && npm test      # 21 testiä
cd web && npm run check # Astro + TypeScript -tarkistus
```
