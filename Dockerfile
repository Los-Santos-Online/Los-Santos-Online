ARG OPENSSL_VERSION=3.4.1
ARG OPENSSL_SHA256=002a2d6b30b58bf4bea46c43bdd96365aaf8daa6c428782aa4feee06da197df3

FROM node:22-bookworm-slim AS openssl-builder
ARG OPENSSL_VERSION
ARG OPENSSL_SHA256
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential ca-certificates curl perl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /tmp/openssl
RUN curl -fsSLO "https://github.com/openssl/openssl/releases/download/openssl-${OPENSSL_VERSION}/openssl-${OPENSSL_VERSION}.tar.gz" \
    && echo "${OPENSSL_SHA256}  openssl-${OPENSSL_VERSION}.tar.gz" | sha256sum -c - \
    && tar -xzf "openssl-${OPENSSL_VERSION}.tar.gz" --strip-components=1 \
    && ./config --prefix=/opt/openssl --openssldir=/opt/openssl/ssl shared \
    && make -j"$(nproc)" \
    && make install_sw install_ssldirs

FROM node:22-bookworm-slim AS openssl-runtime
COPY --from=openssl-builder /opt/openssl /opt/openssl
ENV PATH="/opt/openssl/bin:${PATH}"
ENV LD_LIBRARY_PATH="/opt/openssl/lib64:/opt/openssl/lib"
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN test "$(openssl version)" = "OpenSSL 3.4.1 11 Feb 2025 (Library: OpenSSL 3.4.1 11 Feb 2025)"

FROM openssl-runtime AS certificate-generator
WORKDIR /app
COPY certs/generate-ca-cert.sh /app/tools/generate-ca-cert.sh
COPY src/scripts/generate_relay_keys.js /app/tools/generate_relay_keys.js
ENV CERT_OUTPUT_DIR=/output
USER node
CMD ["sh", "-ec", "sh /app/tools/generate-ca-cert.sh && node /app/tools/generate_relay_keys.js"]

FROM openssl-runtime AS build-dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci \
    && npx prisma generate

FROM build-dependencies AS database-init
CMD ["sh", "-ec", "npx prisma db push && npx prisma db seed"]

FROM build-dependencies AS production-dependencies
RUN npm prune --omit=dev

FROM openssl-runtime AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --chown=node:node --from=production-dependencies /app/node_modules ./node_modules
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node src ./src
USER node
EXPOSE 80
EXPOSE 443
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const s=require('net').connect(Number(process.env.HTTPS_ENDPOINT_PORT || 443),'127.0.0.1');s.setTimeout(4000);s.on('connect',()=>{s.end();process.exit(0)});s.on('timeout',()=>process.exit(1));s.on('error',()=>process.exit(1))"
CMD ["node", "src/main.js"]
