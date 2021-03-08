FROM node:14

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ARG NODE_ENV=${NODE_ENV}
ARG PORT=${PORT}

CMD ["npm", "start"]