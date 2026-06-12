# --- Build stage ----------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
# Fetch self-hosted assets (WASM runtime + face model) into public/, then build.
RUN npm run setup:assets && npm run build

# --- Serve stage ----------------------------------------------------------
FROM nginx:1.27-alpine AS serve
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
