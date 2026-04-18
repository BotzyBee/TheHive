FROM node:alpine AS base

# Install FFmpeg (For audio conversion)
RUN apk update && apk add --no-cache ffmpeg

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

CMD ["node", "./app.js"]