FROM node:22-alpine AS build
WORKDIR /app
ENV NODE_OPTIONS="--dns-result-order=ipv4first --no-network-family-autoselection"
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
COPY package*.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY services/api-gateway/package.json services/api-gateway/package.json
COPY services/auth-service/package.json services/auth-service/package.json
COPY services/customer-service/package.json services/customer-service/package.json
COPY services/extinguisher-service/package.json services/extinguisher-service/package.json
COPY services/notification-service/package.json services/notification-service/package.json
COPY services/police-alert-service/package.json services/police-alert-service/package.json
COPY services/report-service/package.json services/report-service/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --no-audit --no-fund --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000
COPY packages/shared packages/shared
COPY services/police-alert-service services/police-alert-service
RUN npm run build -w @fems/shared && npm run build -w @fems/police-alert-service

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV NODE_OPTIONS="--dns-result-order=ipv4first --no-network-family-autoselection"
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/packages/shared packages/shared
COPY --from=build /app/services/police-alert-service services/police-alert-service
CMD ["node", "services/police-alert-service/dist/server.js"]
