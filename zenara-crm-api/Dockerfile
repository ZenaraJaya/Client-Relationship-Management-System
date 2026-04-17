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

RUN mkdir -p storage/framework/cache/data \
    && mkdir -p storage/framework/sessions \
    && mkdir -p storage/framework/testing \
    && mkdir -p storage/framework/views \
    && mkdir -p storage/logs \
    && mkdir -p bootstrap/cache

COPY . /var/www/html
RUN composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader --ignore-platform-req=ext-grpc

RUN printf "#!/bin/sh\n\
sed -i \"s/80/\${PORT:-10000}/g\" /etc/apache2/sites-available/000-default.conf /etc/apache2/ports.conf\n\
export LOG_CHANNEL=stderr\n\
export APP_DEBUG=true\n\
php artisan migrate --force\n\
(php artisan storage:link || true)\n\
php artisan config:cache\n\
chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache\n\
apache2-foreground\n" > /start.sh && \
    chmod +x /start.sh

CMD ["/start.sh"]
