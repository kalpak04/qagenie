FROM node:16-alpine

# Install PostgreSQL client
RUN apk add --no-cache postgresql-client

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN npm ci --only=production

# Bundle app source
COPY . .

# Add logs directory
RUN mkdir -p logs

# Set NODE_ENV to production
ENV NODE_ENV=production

# Expose port
EXPOSE 5000

# Start app
CMD ["node", "index.js"] 