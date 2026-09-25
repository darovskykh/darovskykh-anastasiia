# syntax=docker/dockerfile:1

# Build stage: compile the Vite application
FROM node:20-alpine AS builder

WORKDIR /app

# Build-time configuration defaults (can be overridden via build args)
ARG VITE_API_BASE_URL="http://127.0.0.1:8000/api/v1"
ARG VITE_WS_BASE_URL="ws://127.0.0.1:8000"

# Expose the values to the build so Vite can read them
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_WS_BASE_URL=${VITE_WS_BASE_URL}

# Install dependencies using Yarn with the lockfile for reproducible builds
COPY package.json yarn.lock ./
RUN corepack enable && yarn install --frozen-lockfile

# Copy the rest of the source and build the production bundle
COPY . .
RUN yarn build

# Runtime stage: serve the built assets via nginx
FROM nginx:1.27-alpine AS runtime

# Copy custom nginx configuration (enables SPA fallback)
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built frontend assets
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
