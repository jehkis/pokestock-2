# 1) Astro-frontendin build; palvelinsivut tarvitsevat ajon aikana web/node_modules-paketit
FROM node:24-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build && npm prune --omit=dev

# 2) Express-rajapinta, joka tarjoilee myös frontendin (valmiit sivut + Astron palvelinsivut)
FROM node:24-alpine
WORKDIR /app/api
COPY api/package.json api/package-lock.json ./
RUN npm ci --omit=dev
COPY api/ ./
COPY --from=web /web/package.json /app/web/package.json
COPY --from=web /web/node_modules /app/web/node_modules
COPY --from=web /web/dist /app/web/dist
EXPOSE 3000
CMD ["node", "server.js"]
