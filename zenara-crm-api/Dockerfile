FROM php:8.4-apache

WORKDIR /var/www/html

RUN apt-get update \
    && apt-get install -y --no-install-recommends git libcurl4-openssl-dev libonig-dev libpq-dev libxml2-dev libzip-dev unzip zip \
    && docker-php-ext-install bcmath curl mbstring pcntl pdo pdo_pgsql xml zip \
    && rm -rf /var/lib/apt/lists/*

ENV APACHE_DOCUMENT_ROOT /var/www/html/public

RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf
RUN sed -ri -e 's!/var/www/!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/apache2.conf /etc/apache2/conf-available/*.conf
RUN a2enmod rewrite

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

COPY . /var/www/html
RUN composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader --ignore-platform-req=ext-grpc

RUN chmod -R 775 storage bootstrap/cache

RUN echo '#!/bin/sh' > /start.sh && \
    echo 'sed -i "s/80/\${PORT:-80}/g" /etc/apache2/sites-available/000-default.conf /etc/apache2/ports.conf' >> /start.sh && \
    echo 'php artisan migrate --force' >> /start.sh && \
    echo '(php artisan storage:link || true)' >> /start.sh && \
    echo 'php artisan config:cache' >> /start.sh && \
    echo 'apache2-foreground' >> /start.sh && \
    chmod +x /start.sh

CMD ["/start.sh"]
