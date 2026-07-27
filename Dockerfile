# Must match "playwright" version in package.json exactly
FROM mcr.microsoft.com/playwright:v1.62.0-noble

WORKDIR /app

# Cache bust — change when Playwright version changes
ARG PLAYWRIGHT_VERSION=1.62.0

COPY package.json package-lock.json ./

# Install deps then ensure browser binaries match npm playwright version
RUN npm ci --omit=dev \
    && npx playwright install chromium

COPY server ./server
COPY public ./public

RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV HEADLESS=true
ENV PORT=3847
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

EXPOSE 3847

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 3847) + '/api/status').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server/index.js"]
