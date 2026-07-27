FROM mcr.microsoft.com/playwright:v1.62.0-noble

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server ./server
COPY public ./public

RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV HEADLESS=true
ENV PORT=3847

EXPOSE 3847

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 3847) + '/api/status').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server/index.js"]
