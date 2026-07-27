FROM node:20-bookworm

WORKDIR /app

# Install app dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Install Chromium + system deps (matches playwright version in package.json)
RUN npx playwright install --with-deps chromium

COPY server ./server
COPY public ./public

RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV HEADLESS=true
ENV PORT=3847

EXPOSE 3847

HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 3847) + '/api/status').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server/index.js"]
