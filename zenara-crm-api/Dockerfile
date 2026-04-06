FROM composer:2 AS vendor

WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader

FROM php:8.3-cli

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq-dev unzip \
    && docker-php-ext-install pdo pdo_pgsql \
    && rm -rf /var/lib/apt/lists/*

COPY --from=vendor /app/vendor /app/vendor
COPY . .

RUN chmod -R 775 storage bootstrap/cache

EXPOSE 10000

CMD sh -c "php artisan config:cache && php artisan route:cache && php -S 0.0.0.0:${PORT:-10000} -t public"
