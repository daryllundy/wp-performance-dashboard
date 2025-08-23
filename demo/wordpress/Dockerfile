FROM wordpress:latest

# Install WP-CLI
RUN curl -O https://raw.githubusercontent.com/wp-cli/wp-cli/v2.8.1/phar/wp-cli.phar && \
    chmod +x wp-cli.phar && \
    mv wp-cli.phar /usr/local/bin/wp

# Install additional tools
RUN apt-get update && apt-get install -y \
    mysql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy initialization script and demo content
COPY demo/wordpress/docker-entrypoint-init.sh /usr/local/bin/
COPY demo/wordpress/init-demo-content.php /tmp/
COPY demo/wordpress/demo-plugins/ /usr/src/wordpress/wp-content/plugins/

# Make initialization script executable
RUN chmod +x /usr/local/bin/docker-entrypoint-init.sh

# Set the custom entrypoint
ENTRYPOINT ["docker-entrypoint-init.sh"]
CMD ["apache2-foreground"]
