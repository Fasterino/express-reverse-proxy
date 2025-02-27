FROM node:21-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

VOLUME /app/vol

CMD npm start