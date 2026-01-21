#!/bin/bash

# WordPress Demo Environment Initialization Script
# This script wraps the official WordPress entrypoint and adds demo setup

echo "Starting WordPress demo environment initialization..."

# Wait for MySQL to be ready
echo "Waiting for MySQL to be ready..."
while ! mysqladmin ping -h"${WORDPRESS_DB_HOST%:*}" -u"$WORDPRESS_DB_USER" -p"$WORDPRESS_DB_PASSWORD" --skip-ssl-verify-server-cert --silent 2>/dev/null; do
    echo "Waiting for MySQL connection..."
    sleep 2
done
echo "MySQL is ready!"

# Run background initialization after WordPress starts
(
    # Wait for WordPress files to be set up by the official entrypoint
    sleep 10

    echo "Setting up demo environment..."

    # Ensure directories exist and copy demo files
    if [ -d "/var/www/html/wp-content" ]; then
        mkdir -p /var/www/html/wp-content/mu-plugins 2>/dev/null || true
        if [ -f "/tmp/init-demo-content.php" ]; then
            cp /tmp/init-demo-content.php /var/www/html/wp-content/mu-plugins/ 2>/dev/null || true
        fi
        chown -R www-data:www-data /var/www/html/wp-content 2>/dev/null || true
    fi

    # Wait a bit more for WordPress to fully initialize
    sleep 5

    # Install WordPress if not already installed
    if ! wp core is-installed --allow-root --path=/var/www/html 2>/dev/null; then
        echo "Installing WordPress..."
        wp core install \
            --allow-root \
            --path=/var/www/html \
            --url="http://localhost:8090" \
            --title="WordPress Performance Dashboard Demo" \
            --admin_user="admin" \
            --admin_password="demo_password" \
            --admin_email="admin@demo.local" \
            --skip-email 2>/dev/null || true
    fi

    # Activate demo plugins and theme
    wp plugin activate performance-simulator --allow-root --path=/var/www/html 2>/dev/null || true
    wp theme activate twentytwentyfour --allow-root --path=/var/www/html 2>/dev/null || true

    echo "Demo environment setup completed!"
) &

# Execute the original WordPress entrypoint
exec docker-entrypoint.sh "$@"
