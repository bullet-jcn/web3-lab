FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

ARG NEXT_DEPLOYMENT_ID
ARG NEXT_PUBLIC_ALCHEMY_API_KEY
ARG NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
ARG NEXT_PUBLIC_OPERATOR_NAME
ARG NEXT_PUBLIC_SUPPORT_EMAIL
ARG NEXT_PUBLIC_ETHEREUM_SEPOLIA_RPC_FALLBACK_URL
ARG NEXT_PUBLIC_ETHEREUM_MAINNET_RPC_FALLBACK_URL
ARG NEXT_PUBLIC_BASE_SEPOLIA_RPC_FALLBACK_URL
ARG NEXT_PUBLIC_BASE_MAINNET_RPC_FALLBACK_URL

ENV NEXT_DEPLOYMENT_ID=$NEXT_DEPLOYMENT_ID
ENV NEXT_PUBLIC_ALCHEMY_API_KEY=$NEXT_PUBLIC_ALCHEMY_API_KEY
ENV NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=$NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
ENV NEXT_PUBLIC_OPERATOR_NAME=$NEXT_PUBLIC_OPERATOR_NAME
ENV NEXT_PUBLIC_SUPPORT_EMAIL=$NEXT_PUBLIC_SUPPORT_EMAIL
ENV NEXT_PUBLIC_ETHEREUM_SEPOLIA_RPC_FALLBACK_URL=$NEXT_PUBLIC_ETHEREUM_SEPOLIA_RPC_FALLBACK_URL
ENV NEXT_PUBLIC_ETHEREUM_MAINNET_RPC_FALLBACK_URL=$NEXT_PUBLIC_ETHEREUM_MAINNET_RPC_FALLBACK_URL
ENV NEXT_PUBLIC_BASE_SEPOLIA_RPC_FALLBACK_URL=$NEXT_PUBLIC_BASE_SEPOLIA_RPC_FALLBACK_URL
ENV NEXT_PUBLIC_BASE_MAINNET_RPC_FALLBACK_URL=$NEXT_PUBLIC_BASE_MAINNET_RPC_FALLBACK_URL

RUN npm run build

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

ARG NEXT_DEPLOYMENT_ID
ENV NEXT_DEPLOYMENT_ID=$NEXT_DEPLOYMENT_ID
ENV RELEASE_ID=$NEXT_DEPLOYMENT_ID

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/migrations ./migrations
COPY --from=builder --chown=nextjs:nodejs /app/scripts/migrate.mjs ./scripts/migrate.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/data-retention.mjs ./scripts/data-retention.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/verify-backup-evidence.mjs ./scripts/verify-backup-evidence.mjs
COPY --from=builder --chown=nextjs:nodejs /app/lib/server/backendConfig.ts ./lib/server/backendConfig.ts
COPY --from=builder --chown=nextjs:nodejs /app/lib/server/dataLifecycle.ts ./lib/server/dataLifecycle.ts
COPY --from=builder --chown=nextjs:nodejs /app/lib/server/backupEvidence.ts ./lib/server/backupEvidence.ts

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health/live').then((response)=>{if(!response.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
