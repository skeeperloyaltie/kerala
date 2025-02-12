# Base image
FROM nginx:latest 

# Copy SSL certificates
COPY /nginx_ssl/nginx-selfsigned.crt /etc/ssl/certs/nginx-selfsigned.crt
COPY /nginx_ssl/nginx-selfsigned.key /etc/ssl/private/nginx-selfsigned.key

# Copy custom Nginx config


# Copy the Nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy all files to the Nginx server's document root
COPY . /usr/share/nginx/html/

# Expose port
EXPOSE 80
