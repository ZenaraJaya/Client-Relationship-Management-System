<?php

namespace App\Services;

use App\Models\MicrosoftCalendarConnection;
use App\Models\User;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;

class MicrosoftCalendarOAuthService
{
    public function delegatedAuthConfigured(): bool
    {
        return (bool) config('services.microsoft_graph.tenant_id')
            && (bool) config('services.microsoft_graph.client_id')
            && (bool) config('services.microsoft_graph.client_secret')
            && (bool) config('services.microsoft_graph.redirect_uri');
    }

    public function buildAuthorizationUrl(User $user, string $origin): string
    {
        if (!$this->delegatedAuthConfigured()) {
            throw new RuntimeException('Microsoft calendar OAuth is not configured.');
        }

        return $this->buildAuthorizationUrlFromPayload([
            'nonce' => Str::random(40),
            'flow' => 'connect',
            'user_id' => $user->id,
            'origin' => $origin,
            'expires_at' => now()->addMinutes($this->stateTtlMinutes())->timestamp,
        ]);
    }

    public function buildAuthAuthorizationUrl(string $origin, string $mode = 'login', string $role = 'staff'): string
    {
        if (!$this->delegatedAuthConfigured()) {
            throw new RuntimeException('Microsoft calendar OAuth is not configured.');
        }

        $normalizedMode = strtolower(trim($mode));
        if (!in_array($normalizedMode, ['login', 'signup'], true)) {
            $normalizedMode = 'login';
        }

        $normalizedRole = strtolower(trim($role));
        if (!in_array($normalizedRole, ['admin', 'staff'], true)) {
            $normalizedRole = 'staff';
        }

        return $this->buildAuthorizationUrlFromPayload([
            'nonce' => Str::random(40),
            'flow' => 'auth',
            'mode' => $normalizedMode,
            'role' => $normalizedRole,
            'origin' => $origin,
            'expires_at' => now()->addMinutes($this->stateTtlMinutes())->timestamp,
        ]);
    }

    protected function buildAuthorizationUrlFromPayload(array $payload): string
    {
        $state = $this->encodeStatePayload($payload);

        $query = http_build_query([
            'client_id' => config('services.microsoft_graph.client_id'),
            'response_type' => 'code',
            'redirect_uri' => config('services.microsoft_graph.redirect_uri'),
            'response_mode' => 'query',
            'scope' => $this->delegatedScopes(),
            'state' => $state,
            'prompt' => 'select_account',
        ]);

        return "https://login.microsoftonline.com/{$this->tenantId()}/oauth2/v2.0/authorize?{$query}";
    }

    public function parseStatePayload(string $state): array
    {
        $payload = $this->decodeStatePayloadRaw($state);
        $flow = strtolower(trim((string) ($payload['flow'] ?? 'connect')));

        if (!in_array($flow, ['connect', 'auth'], true)) {
            throw new RuntimeException('Microsoft authorization state is invalid or expired.');
        }

        $result = [
            'flow' => $flow,
            'origin' => (string) ($payload['origin'] ?? ''),
        ];

        if ($flow === 'connect') {
            if (empty($payload['user_id'])) {
                throw new RuntimeException('Microsoft authorization state is invalid or expired.');
            }

            $result['user_id'] = (int) $payload['user_id'];
            return $result;
        }

        $mode = strtolower(trim((string) ($payload['mode'] ?? 'login')));
        if (!in_array($mode, ['login', 'signup'], true)) {
            $mode = 'login';
        }

        $role = strtolower(trim((string) ($payload['role'] ?? 'staff')));
        if (!in_array($role, ['admin', 'staff'], true)) {
            $role = 'staff';
        }

        $result['mode'] = $mode;
        $result['role'] = $role;
        return $result;
    }

    public function completeAuthorization(string $state, string $code): array
    {
        $payload = $this->decodeStatePayload($state);

        $tokenData = $this->exchangeAuthorizationCode($code);
        $profile = $this->fetchCurrentUserProfile((string) ($tokenData['access_token'] ?? ''));

        $user = User::query()->find($payload['user_id']);
        if (!$user) {
            throw new RuntimeException('The local user account was not found.');
        }

        $email = trim((string) ($profile['mail'] ?? $profile['userPrincipalName'] ?? ''));
        if ($email === '') {
            throw new RuntimeException('Microsoft did not return a usable email address.');
        }

        $connection = MicrosoftCalendarConnection::query()->updateOrCreate(
            ['user_id' => $user->id],
            [
                'microsoft_user_id' => (string) ($profile['id'] ?? ''),
                'microsoft_email' => $email,
                'microsoft_display_name' => (string) ($profile['displayName'] ?? $email),
                'access_token' => (string) ($tokenData['access_token'] ?? ''),
                'refresh_token' => (string) ($tokenData['refresh_token'] ?? ''),
                'scopes' => (string) ($tokenData['scope'] ?? $this->delegatedScopes()),
                'access_token_expires_at' => Carbon::now()->addSeconds(max(60, (int) ($tokenData['expires_in'] ?? 3600))),
                'connected_at' => now(),
                'last_synced_at' => now(),
            ]
        );

        return [
            'origin' => (string) ($payload['origin'] ?? ''),
            'user' => $user,
            'connection' => $connection,
        ];
    }

    public function completeAuthAuthorization(string $state, string $code): array
    {
        $payload = $this->parseStatePayload($state);
        if (($payload['flow'] ?? null) !== 'auth') {
            throw new RuntimeException('Microsoft authorization state is invalid or expired.');
        }

        $tokenData = $this->exchangeAuthorizationCode($code);
        $profile = $this->fetchCurrentUserProfile((string) ($tokenData['access_token'] ?? ''));

        $email = trim((string) ($profile['mail'] ?? $profile['userPrincipalName'] ?? ''));
        if ($email === '') {
            throw new RuntimeException('Microsoft did not return a usable email address.');
        }

        $normalizedEmail = strtolower($email);
        $mode = (string) ($payload['mode'] ?? 'login');
        $requestedRole = (string) ($payload['role'] ?? 'staff');
        $created = false;

        $user = User::query()
            ->whereRaw('LOWER(email) = ?', [$normalizedEmail])
            ->first();

        if (!$user) {
            if ($mode !== 'signup') {
                throw new RuntimeException('No account found for this Outlook email. Please sign up first.');
            }

            $displayName = trim((string) ($profile['displayName'] ?? ''));
            if ($displayName === '') {
                $displayName = trim((string) Str::of($normalizedEmail)->before('@')->replace(['.', '_', '-'], ' ')->title());
            }
            if ($displayName === '') {
                $displayName = 'Outlook User';
            }

            $user = User::create([
                'name' => $displayName,
                'email' => $normalizedEmail,
                'role' => $requestedRole,
                'password' => Str::random(48),
            ]);
            $created = true;
        }

        $connection = MicrosoftCalendarConnection::query()->updateOrCreate(
            ['user_id' => $user->id],
            [
                'microsoft_user_id' => (string) ($profile['id'] ?? ''),
                'microsoft_email' => $normalizedEmail,
                'microsoft_display_name' => (string) ($profile['displayName'] ?? $normalizedEmail),
                'access_token' => (string) ($tokenData['access_token'] ?? ''),
                'refresh_token' => (string) ($tokenData['refresh_token'] ?? ''),
                'scopes' => (string) ($tokenData['scope'] ?? $this->delegatedScopes()),
                'access_token_expires_at' => Carbon::now()->addSeconds(max(60, (int) ($tokenData['expires_in'] ?? 3600))),
                'connected_at' => now(),
                'last_synced_at' => now(),
            ]
        );

        return [
            'origin' => (string) ($payload['origin'] ?? ''),
            'user' => $user,
            'connection' => $connection,
            'mode' => $mode,
            'created' => $created,
        ];
    }

    public function resolveOriginFromState(string $state): ?string
    {
        if (trim($state) === '') {
            return null;
        }

        try {
            $payload = $this->parseStatePayload($state);
        } catch (\Throwable) {
            return null;
        }

        return (string) ($payload['origin'] ?? '');
    }

    public function getConnectionForUser(User $user): ?MicrosoftCalendarConnection
    {
        return $user->relationLoaded('microsoftCalendarConnection')
            ? $user->microsoftCalendarConnection
            : $user->microsoftCalendarConnection()->first();
    }

    public function getValidAccessTokenForUser(User $user): ?string
    {
        $connection = $this->getConnectionForUser($user);
        if (!$connection) {
            return null;
        }

        $expiresAt = $connection->access_token_expires_at;
        if ($connection->access_token && $expiresAt && $expiresAt->isFuture() && $expiresAt->gt(now()->addMinutes(2))) {
            return $connection->access_token;
        }

        if (!$connection->refresh_token || !$this->delegatedAuthConfigured()) {
            return null;
        }

        $tokenData = $this->refreshAccessToken($connection->refresh_token);
        $connection->forceFill([
            'access_token' => (string) ($tokenData['access_token'] ?? ''),
            'refresh_token' => (string) ($tokenData['refresh_token'] ?? $connection->refresh_token),
            'scopes' => (string) ($tokenData['scope'] ?? $connection->scopes),
            'access_token_expires_at' => Carbon::now()->addSeconds(max(60, (int) ($tokenData['expires_in'] ?? 3600))),
            'last_synced_at' => now(),
        ])->save();

        return $connection->access_token;
    }

    public function disconnect(User $user): void
    {
        $user->microsoftCalendarConnection()->delete();
    }

    protected function exchangeAuthorizationCode(string $code): array
    {
        $response = $this->oauthHttp()->asForm()->post(
            "https://login.microsoftonline.com/{$this->tenantId()}/oauth2/v2.0/token",
            [
                'grant_type' => 'authorization_code',
                'client_id' => config('services.microsoft_graph.client_id'),
                'client_secret' => config('services.microsoft_graph.client_secret'),
                'redirect_uri' => config('services.microsoft_graph.redirect_uri'),
                'code' => $code,
                'scope' => $this->delegatedScopes(),
            ]
        );

        return $this->decodeSuccessfulResponse($response, 'token exchange');
    }

    protected function refreshAccessToken(string $refreshToken): array
    {
        $response = $this->oauthHttp()->asForm()->post(
            "https://login.microsoftonline.com/{$this->tenantId()}/oauth2/v2.0/token",
            [
                'grant_type' => 'refresh_token',
                'client_id' => config('services.microsoft_graph.client_id'),
                'client_secret' => config('services.microsoft_graph.client_secret'),
                'refresh_token' => $refreshToken,
                'scope' => $this->delegatedScopes(),
            ]
        );

        return $this->decodeSuccessfulResponse($response, 'token refresh');
    }

    protected function fetchCurrentUserProfile(string $accessToken): array
    {
        $response = $this->oauthHttp()
            ->withToken($accessToken)
            ->get('https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName');

        return $this->decodeSuccessfulResponse($response, 'profile fetch');
    }

    protected function delegatedScopes(): string
    {
        return trim((string) config(
            'services.microsoft_graph.delegated_scopes',
            'openid profile offline_access User.Read Calendars.ReadWrite'
        ));
    }

    protected function tenantId(): string
    {
        return trim((string) config('services.microsoft_graph.tenant_id'));
    }

    protected function stateTtlMinutes(): int
    {
        return max(5, (int) config('services.microsoft_graph.oauth_state_ttl_minutes', 10));
    }

    protected function encodeStatePayload(array $payload): string
    {
        $json = json_encode($payload, JSON_THROW_ON_ERROR);
        $encodedPayload = $this->base64UrlEncode($json);
        $signature = hash_hmac('sha256', $encodedPayload, $this->stateSecret());

        return $encodedPayload . '.' . $signature;
    }

    protected function decodeStatePayload(string $state): array
    {
        $payload = $this->decodeStatePayloadRaw($state);
        if (empty($payload['user_id'])) {
            throw new RuntimeException('Microsoft authorization state is invalid or expired.');
        }

        return [
            'user_id' => (int) $payload['user_id'],
            'origin' => (string) ($payload['origin'] ?? ''),
        ];
    }

    protected function decodeStatePayloadRaw(string $state): array
    {
        $parts = explode('.', $state, 2);
        if (count($parts) !== 2 || trim($parts[0]) === '' || trim($parts[1]) === '') {
            throw new RuntimeException('Microsoft authorization state is invalid or expired.');
        }

        [$encodedPayload, $signature] = $parts;
        $expectedSignature = hash_hmac('sha256', $encodedPayload, $this->stateSecret());
        if (!hash_equals($expectedSignature, $signature)) {
            throw new RuntimeException('Microsoft authorization state is invalid or expired.');
        }

        $json = $this->base64UrlDecode($encodedPayload);
        $payload = json_decode($json, true);
        if (!is_array($payload)) {
            throw new RuntimeException('Microsoft authorization state is invalid or expired.');
        }

        $origin = trim((string) ($payload['origin'] ?? ''));
        $expiresAt = (int) ($payload['expires_at'] ?? 0);

        if ($origin === '' || !filter_var($origin, FILTER_VALIDATE_URL) || $expiresAt < now()->timestamp) {
            throw new RuntimeException('Microsoft authorization state is invalid or expired.');
        }

        $payload['origin'] = $origin;
        return $payload;
    }

    protected function stateSecret(): string
    {
        $appKey = trim((string) config('app.key'));
        if ($appKey !== '') {
            return $appKey;
        }

        $clientSecret = trim((string) config('services.microsoft_graph.client_secret'));
        if ($clientSecret !== '') {
            return $clientSecret;
        }

        throw new RuntimeException('Microsoft OAuth state signing is not configured.');
    }

    protected function base64UrlEncode(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    protected function base64UrlDecode(string $value): string
    {
        $decoded = base64_decode(strtr($value, '-_', '+/') . str_repeat('=', (4 - strlen($value) % 4) % 4), true);
        if ($decoded === false) {
            throw new RuntimeException('Microsoft authorization state is invalid or expired.');
        }

        return $decoded;
    }

    protected function decodeSuccessfulResponse(Response $response, string $action): array
    {
        if (!$response->successful()) {
            throw new RuntimeException($this->formatMicrosoftError($response, $action));
        }

        $payload = $response->json();
        if (!is_array($payload)) {
            throw new RuntimeException("Microsoft {$action} returned an invalid response.");
        }

        return $payload;
    }

    protected function formatMicrosoftError(Response $response, string $action): string
    {
        $payload = $response->json();
        $errorCode = '';
        $message = '';

        if (is_array($payload)) {
            $nestedError = $payload['error'] ?? null;

            if (is_string($nestedError)) {
                $errorCode = trim($nestedError);
            } elseif (is_array($nestedError)) {
                $errorCode = trim((string) ($nestedError['code'] ?? ''));
                $message = trim((string) ($nestedError['message'] ?? ''));
            }

            if ($message === '') {
                $message = trim((string) ($payload['error_description'] ?? $payload['message'] ?? ''));
            }
        }

        if ($message === '') {
            $message = trim((string) $response->body());
        }

        $message = preg_replace('/\s+Trace ID:.*$/i', '', $message ?? '');
        $message = preg_replace('/\s+Correlation ID:.*$/i', '', $message ?? '');
        $message = preg_replace('/\s+Timestamp:.*$/i', '', $message ?? '');
        $message = trim(preg_replace('/\s+/', ' ', $message ?? ''));

        if ($message === '') {
            return "Microsoft {$action} failed.";
        }

        if ($errorCode !== '' && stripos($message, $errorCode) === false) {
            return "{$errorCode}: {$message}";
        }

        return $message;
    }

    protected function oauthHttp(): PendingRequest
    {
        return Http::timeout(15)->connectTimeout(8);
    }
}
