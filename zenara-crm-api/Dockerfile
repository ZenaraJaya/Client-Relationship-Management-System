FROM php:8.4-cli

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends git libcurl4-openssl-dev libonig-dev libpq-dev libxml2-dev libzip-dev unzip zip \
    && docker-php-ext-install bcmath curl mbstring pcntl pdo pdo_pgsql xml zip \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

COPY . /app
RUN composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader --ignore-platform-req=ext-grpc

RUN chmod -R 775 storage bootstrap/cache

EXPOSE 10000

CMD sh -c "php artisan migrate --force && (php artisan storage:link || true) && php artisan config:cache && php -d memory_limit=512M -S 0.0.0.0:${PORT:-10000} server.php"
