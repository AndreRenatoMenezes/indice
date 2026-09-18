# Índice API — imagem para Cloud Run. Build a partir da RAIZ do monorepo:
#   docker build -f apps/api/Dockerfile -t indice-api .
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
RUN npm ci --workspace @indice/api --workspace @indice/db --workspace @indice/shared --include-workspace-root

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN npx prisma generate --schema packages/db/prisma/schema.prisma \
 && npm run build -w @indice/api

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/packages/db/package.json ./packages/db/
COPY --from=build /app/packages/db/prisma ./packages/db/prisma
COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/apps/api/dist ./apps/api/dist
EXPOSE 8080
USER node
CMD ["node", "apps/api/dist/apps/api/src/server.js"]
