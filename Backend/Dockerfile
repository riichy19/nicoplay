FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY Backend/package.json ./Backend/package.json
COPY FrontEnd/reproductor-mp3/package.json ./FrontEnd/reproductor-mp3/package.json
RUN npm ci

COPY FrontEnd/reproductor-mp3 ./FrontEnd/reproductor-mp3
RUN npm run build

FROM node:22-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg python3 python3-pip ca-certificates \
    && python3 -m pip install --break-system-packages --no-cache-dir "yt-dlp[default]" \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json app.js ./
COPY Backend/package.json ./Backend/package.json
COPY FrontEnd/reproductor-mp3/package.json ./FrontEnd/reproductor-mp3/package.json
RUN npm ci --omit=dev

COPY Backend/src ./Backend/src
COPY --from=builder /app/FrontEnd/reproductor-mp3/dist ./FrontEnd/reproductor-mp3/dist

ENV NODE_ENV=production
ENV PORT=3000
ENV TEMP_DIR=/tmp/convertidor

RUN mkdir -p /tmp/convertidor \
    && chown -R node:node /tmp/convertidor

EXPOSE 3000

USER node
CMD ["node", "app.js"]
