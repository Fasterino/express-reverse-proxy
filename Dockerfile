FROM node:21-alpine
RUN mkdir /app
WORKDIR /app
COPY . .
RUN mkdir dist
RUN npm install

VOLUME /app/vol

CMD npm run start