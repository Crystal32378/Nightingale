# Nightingale presentation server — one image, both clouds.
# Google Cloud Run:      gcloud run deploy nightingale-present --source .
# Nebius Serverless:     push this image, serve from it.
FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.server.json ./
COPY src/cloud ./src/cloud
COPY src/engine ./src/engine
COPY server ./server
RUN npx tsc -p tsconfig.server.json
RUN echo '{"type":"commonjs"}' > dist/package.json
ENV PORT=8080
EXPOSE 8080
CMD ["node", "dist/server/present.js"]
