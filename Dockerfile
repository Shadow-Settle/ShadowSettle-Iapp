# ShadowSettle iApp — runs in iExec TEE (linux/amd64)
# Use the same base image as the official iapp JavaScript template so sconify (TEE transform) succeeds.
# See: npm i -g @iexec/iapp → templates/JavaScript/Dockerfile
FROM node:22-alpine3.21

WORKDIR /app

COPY package.json ./
COPY app ./app

# Use absolute path so TEE (SCONE) still finds the script when it sets CWD to /.
ENTRYPOINT ["node", "--disable-wasm-trap-handler", "/app/app/index.js"]
