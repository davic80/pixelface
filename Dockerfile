# --- Build stage ----------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
# Fetch self-hosted assets (WASM runtime + face model) into public/, then build.
RUN npm run setup:assets && npm run build

# --- Serve stage ----------------------------------------------------------
FROM node:22-alpine AS serve
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=80
ENV DATA_DIR=/data

# The backend has zero dependencies, so we only need the built site + server.
COPY --from=build /app/dist ./dist
COPY server ./server

VOLUME ["/data"]
EXPOSE 80
CMD ["node", "server/server.mjs"]
