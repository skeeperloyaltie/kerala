# Base image
FROM nginx:alpine

# Copy the Nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy static assets
COPY assets/ /usr/share/nginx/html/assets/

# Expose port
EXPOSE 80
