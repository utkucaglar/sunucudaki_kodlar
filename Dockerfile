FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Expose default port
EXPOSE 8000

# Start the application
CMD ["node", "mcp-server-smithery.js"] 