FROM node:alpine AS base

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

CMD ["node", "./app.js"]