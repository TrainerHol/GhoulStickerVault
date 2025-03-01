FROM node:18-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy the rest of the application
COPY . .

# Create a volume for the database persistence
VOLUME /app

# Set environment variables
ENV DB_PATH=stickers.db
ENV NODE_ENV=production

# Run the application
CMD ["node", "index.js"] 