# 1) Astro-frontendin build
FROM node:24-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# 2) Express-rajapinta, joka tarjoilee myos frontendin
FROM node:24-alpine
WORKDIR /app
COPY api/package.json api/package-lock.json ./
RUN npm ci --omit=dev
COPY api/ ./
COPY --from=web /web/dist ./public
ENV STATIC_DIR=/app/public
EXPOSE 3000
CMD ["node", "server.js"]
