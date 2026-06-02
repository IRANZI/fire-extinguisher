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
COPY frontend frontend
ARG VITE_API_URL=http://localhost:4000/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build -w @fems/frontend

FROM nginx:1.27-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
