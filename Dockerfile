FROM node:24-alpine

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY package*.json ./

RUN npm ci --legacy-peer-deps

COPY . .

RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]

