FROM node:22-alpine
WORKDIR /app
COPY server/package*.json ./
RUN npm install
COPY server/ ./
COPY prisma/ ./prisma/
RUN npx prisma generate
EXPOSE 4000
CMD ["npm", "run", "dev"]