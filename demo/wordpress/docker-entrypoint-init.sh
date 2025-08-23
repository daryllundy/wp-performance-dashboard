#!/bin/bash

# WordPress Demo Environment Initialization Script
# This script sets up the WordPress demo environment with proper configuration

set -e

echo "Starting WordPress demo environment initialization..."

# Wait for MySQL to be ready
echo "Waiting for MySQL to be ready..."
while ! mysqladmin ping -h"$WORDPRESS_DB_HOST" -u"$WORDPRESS_DB_USER" -p"$WORDPRESS_DB_PASSWORD" --silent; do
    echo "Waiting for MySQL connection..."
    sleep 2
done

echo "MySQL is ready!"

# Ensure mu-plugins directory exists
mkdir -p /var/www/html/wp-content/mu-plugins

# Copy demo initialization script to mu-plugins
if [ -f "/tmp/init-demo-content.php" ]; then
    cp /tmp/init-demo-content.php /var/www/html/wp-content/mu-plugins/
    echo "Demo content initializer installed as must-use plugin"
fi

# Set proper permissions
chown -R www-data:www-data /var/www/html/wp-content
chmod -R 755 /var/www/html/wp-content

# Install WordPress if not already installed
if ! wp core is-installed --allow-root --path=/var/www/html 2>/dev/null; then
    echo "Installing WordPress..."
    
    wp core install \
        --allow-root \
        --path=/var/www/html \
        --url="http://localhost:8090" \
        --title="WordPress Performance Dashboard Demo" \
        --admin_user="demo_admin" \
        --admin_password="demo_password" \
        --admin_email="admin@demo.local" \
        --skip-email
    
    echo "WordPress installed successfully"
else
    echo "WordPress is already installed"
fi

# Activate demo plugins
echo "Activating demo plugins..."
wp plugin activate demo-plugins/performance-simulator --allow-root --path=/var/www/html || echo "Performance simulator plugin not found or already active"

# Set demo theme
echo "Setting up demo theme..."
wp theme activate twentytwentyfour --allow-root --path=/var/www/html || echo "Theme activation failed or already active"

# Configure WordPress settings for demo
echo "Configuring WordPress settings..."
wp option update blogname "WordPress Performance Dashboard Demo" --allow-root --path=/var/www/html
wp option update blogdescription "Demonstrating WordPress performance monitoring capabilities" --allow-root --path=/var/www/html
wp option update posts_per_page 10 --allow-root --path=/var/www/html
wp option update default_comment_status "open" --allow-root --path=/var/www/html

echo "WordPress demo environment initialization completed!"

# Execute the original WordPress entrypoint
exec "$@"
