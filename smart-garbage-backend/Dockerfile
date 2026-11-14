# syntax=docker/dockerfile:1
# NOTE: the optional Python garbage classifier (PYTHON_EXECUTABLE / GARBAGE_MODEL_PATH)
# is NOT included in this image. The API runs without it.

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:20-alpine AS runtime
ENV NODE_ENV=production \
    PORT=5000
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY database ./database
RUN mkdir -p /app/uploads && chown -R node:node /app
USER node
VOLUME ["/app/uploads"]
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5000/health >/dev/null || exit 1
# Apply pending migrations, then start the API (exec so signals reach node).
CMD ["sh", "-c", "node database/migrations/runMigrations.js && exec node src/index.js"]
