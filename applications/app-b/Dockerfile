FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate || true
EXPOSE 3002
CMD ["npm", "run", "dev", "--", "-p", "3002"]