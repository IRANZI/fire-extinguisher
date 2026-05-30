FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY services/inventory-service/package.json services/inventory-service/package.json
RUN npm install
COPY packages/shared packages/shared
COPY services/inventory-service services/inventory-service
RUN npm run build -w @fems/shared && npm run build -w @fems/inventory-service

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/packages/shared packages/shared
COPY --from=build /app/services/inventory-service services/inventory-service
CMD ["node", "services/inventory-service/dist/server.js"]

