FROM node:14-alpine

WORKDIR /usr/src
COPY . .
RUN npm install

CMD ["npm", "start"]