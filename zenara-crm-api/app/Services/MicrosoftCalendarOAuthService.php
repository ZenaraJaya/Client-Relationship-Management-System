<?php

namespace App\Services;

use App\Models\MicrosoftCalendarConnection;
use App\Models\User;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Crypt;
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

        $state = $this->encodeStatePayload([
            'nonce' => Str::random(40),
            'user_id' => $user->id,
            'origin' => $origin,
            'expires_at' => now()->addMinutes($this->stateTtlMinutes())->timestamp,
        ]);

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

    public function resolveOriginFromState(string $state): ?string
    {
        if (trim($state) === '') {
            return null;
        }

        try {
            $payload = $this->decodeStatePayload($state);
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
        return Crypt::encryptString(json_encode($payload, JSON_THROW_ON_ERROR));
    }

    protected function decodeStatePayload(string $state): array
    {
        try {
            $json = Crypt::decryptString($state);
        } catch (DecryptException $e) {
            throw new RuntimeException('Microsoft authorization state is invalid or expired.', 0, $e);
        }

        $payload = json_decode($json, true);
        if (!is_array($payload) || empty($payload['user_id'])) {
            throw new RuntimeException('Microsoft authorization state is invalid or expired.');
        }

        $origin = trim((string) ($payload['origin'] ?? ''));
        $expiresAt = (int) ($payload['expires_at'] ?? 0);

        if ($origin === '' || !filter_var($origin, FILTER_VALIDATE_URL) || $expiresAt < now()->timestamp) {
            throw new RuntimeException('Microsoft authorization state is invalid or expired.');
        }

        return [
            'user_id' => (int) $payload['user_id'],
            'origin' => $origin,
        ];
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
