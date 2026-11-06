# FFmpeg media worker for Settings cinematic video (NOT n8n Cloud Execute Command).
FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libheif-examples \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.js ./
COPY scripts ./scripts

ENV PORT=8787
EXPOSE 8787
CMD ["node", "server.js"]
