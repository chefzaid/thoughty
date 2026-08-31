# Stage 1: Install dependencies
FROM docker.io/library/node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# Stage 2: Build
FROM docker.io/library/node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
# Google sign-in client ID is baked in at build time (Vite inlines VITE_* vars).
ARG VITE_GOOGLE_CLIENT_ID=""
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
RUN npm run build

# Stage 3: Serve with nginx
FROM docker.io/nginxinc/nginx-unprivileged:1.30.4-alpine@sha256:bc69cfff69f75aef06daeda8dea70de95fa9ad97a03fe134cd4e5e6789d51124 AS production

COPY --from=build --chown=101:101 /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

USER 101:101

CMD ["nginx", "-g", "daemon off;"]
