FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY services/api-gateway/package.json services/api-gateway/package.json
RUN npm install
COPY packages/shared packages/shared
COPY services/api-gateway services/api-gateway
RUN npm run build -w @fems/shared && npm run build -w @fems/api-gateway

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/packages/shared packages/shared
COPY --from=build /app/services/api-gateway services/api-gateway
CMD ["node", "services/api-gateway/dist/server.js"]

