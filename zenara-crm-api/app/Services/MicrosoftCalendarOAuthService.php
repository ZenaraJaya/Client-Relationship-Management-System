<?php

namespace App\Services;

use App\Models\MicrosoftCalendarConnection;
use App\Models\User;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;

class MicrosoftCalendarOAuthService
{
    protected const STATE_CACHE_PREFIX = 'microsoft_calendar_oauth_state:';

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

        $state = Str::random(64);
        Cache::put(
            self::STATE_CACHE_PREFIX . $state,
            [
                'user_id' => $user->id,
                'origin' => $origin,
            ],
            now()->addMinutes(max(5, (int) config('services.microsoft_graph.oauth_state_ttl_minutes', 10)))
        );

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
        $payload = Cache::pull(self::STATE_CACHE_PREFIX . $state);
        if (!is_array($payload) || empty($payload['user_id'])) {
            throw new RuntimeException('Microsoft authorization state is invalid or expired.');
        }

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

        if (!$response->successful()) {
            throw new RuntimeException('Microsoft token exchange failed: ' . $response->body());
        }

        return $response->json();
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

        if (!$response->successful()) {
            throw new RuntimeException('Microsoft token refresh failed: ' . $response->body());
        }

        return $response->json();
    }

    protected function fetchCurrentUserProfile(string $accessToken): array
    {
        $response = $this->oauthHttp()
            ->withToken($accessToken)
            ->get('https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName');

        if (!$response->successful()) {
            throw new RuntimeException('Microsoft profile fetch failed: ' . $response->body());
        }

        return $response->json();
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

    protected function oauthHttp(): PendingRequest
    {
        return Http::timeout(15)->connectTimeout(8);
    }
}
