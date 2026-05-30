FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY services/notification-service/package.json services/notification-service/package.json
RUN npm install
COPY packages/shared packages/shared
COPY services/notification-service services/notification-service
RUN npm run build -w @fems/shared && npm run build -w @fems/notification-service

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/packages/shared packages/shared
COPY --from=build /app/services/notification-service services/notification-service
CMD ["node", "services/notification-service/dist/server.js"]

