# Base image
FROM nginx:alpine

# Copy the Nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

COPY index.html /usr/share/nginx/html/index.html

# Copy static assets
COPY assets/ /usr/share/nginx/html/assets/

# Expose port
EXPOSE 80
