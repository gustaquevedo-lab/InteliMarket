FROM node:20-alpine

WORKDIR /app

COPY ui-web/package*.json ./
RUN npm install --legacy-peer-deps

COPY ui-web/ .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
