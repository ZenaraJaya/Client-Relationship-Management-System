<?php

use Illuminate\Support\Str;

$corsOrigins = array_values(array_filter(array_map(
    fn ($origin) => trim($origin),
    explode(',', (string) env('CORS_ALLOWED_ORIGINS', 'https://zenaracrm.vercel.app,http://localhost:3000,http://127.0.0.1:3000'))
)));

$corsOriginPatterns = array_values(array_filter(array_map(
    fn ($pattern) => trim($pattern),
    explode(',', (string) env('CORS_ALLOWED_ORIGIN_PATTERNS', '/^https:\\/\\/.*\\.vercel\\.app$/'))
)));

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Here you may configure your settings for cross-origin resource sharing
    | or "CORS". This determines what cross-origin requests are allowed on
    | your Laravel application. The "allowed_methods" includes the methods
    | that are allowed for cross-origin requests.
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    'allowed_origins' => $corsOrigins,

    'allowed_origins_patterns' => $corsOriginPatterns,

    'allowed_headers' => ['Accept', 'Authorization', 'Content-Type', 'Origin', 'X-Requested-With'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,

];
