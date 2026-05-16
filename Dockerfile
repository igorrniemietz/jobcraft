FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
COPY server.js ./
COPY public/ ./public/
EXPOSE 8080
CMD ["node", "server.js"]
