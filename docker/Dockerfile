FROM node:18-alpine

WORKDIR /app

COPY backend/package.json ./
RUN npm install --production

COPY backend/ ./
COPY sdk/ ./sdk/

EXPOSE 3000

CMD ["node", "server.js"]
