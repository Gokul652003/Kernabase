# Builds the SPA, then ships it inside Caddy so a single edge container terminates TLS,
# serves the static files and proxies /api to the backend. Fewer moving parts than a
# separate "static files" container that has to share a volume with a proxy.
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src
RUN npm run build

FROM caddy:2-alpine AS runtime
COPY --from=build /app/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
