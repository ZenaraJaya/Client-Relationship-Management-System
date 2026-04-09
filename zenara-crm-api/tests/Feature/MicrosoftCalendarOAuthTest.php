<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class MicrosoftCalendarOAuthTest extends TestCase
{
    use RefreshDatabase;

    protected function authHeadersFor(User $user, string $plainToken = 'microsoft-oauth-token'): array
    {
        $user->forceFill([
            'api_token' => hash('sha256', $plainToken),
            'api_token_expires_at' => Carbon::now()->addHour(),
        ])->save();

        return [
            'Authorization' => 'Bearer ' . $plainToken,
        ];
    }

    protected function configureMicrosoftOauth(): void
    {
        config()->set('app.key', 'base64:J63j5LhQgnP+7z8P7bo9I7G0mWvD6A8mVjbR2E6xH2E=');
        config()->set('services.microsoft_graph.tenant_id', 'common');
        config()->set('services.microsoft_graph.client_id', 'client-id');
        config()->set('services.microsoft_graph.client_secret', 'client-secret');
        config()->set('services.microsoft_graph.redirect_uri', 'https://api.example.test/api/auth/microsoft/callback');
        config()->set('services.microsoft_graph.delegated_scopes', 'openid profile offline_access User.Read Calendars.ReadWrite');
        config()->set('services.microsoft_graph.oauth_state_ttl_minutes', 10);
    }

    public function test_microsoft_callback_connects_account_without_relying_on_cache_state(): void
    {
        $this->configureMicrosoftOauth();

        $user = User::factory()->create([
            'email' => 'staff@example.com',
            'role' => 'staff',
        ]);

        $connectResponse = $this
            ->withHeaders($this->authHeadersFor($user, 'oauth-connect-token'))
            ->getJson('/api/auth/microsoft/connect-url?origin=' . urlencode('https://frontend.example.test'));

        $connectResponse->assertOk();

        $authorizationUrl = $connectResponse->json('url');
        $this->assertNotEmpty($authorizationUrl);

        parse_str((string) parse_url((string) $authorizationUrl, PHP_URL_QUERY), $query);
        $this->assertArrayHasKey('state', $query);
        $this->assertSame('https://api.example.test/api/auth/microsoft/callback', $query['redirect_uri'] ?? null);

        Cache::flush();

        Http::fake([
            'https://login.microsoftonline.com/*/oauth2/v2.0/token' => Http::response([
                'access_token' => 'access-token',
                'refresh_token' => 'refresh-token',
                'expires_in' => 3600,
                'scope' => 'openid profile offline_access User.Read Calendars.ReadWrite',
            ], 200),
            'https://graph.microsoft.com/v1.0/me*' => Http::response([
                'id' => 'microsoft-user-id',
                'displayName' => 'Staff Example',
                'mail' => 'staff@example.com',
                'userPrincipalName' => 'staff@example.com',
            ], 200),
        ]);

        $callbackResponse = $this->get(
            '/api/auth/microsoft/callback?state=' . urlencode((string) $query['state']) . '&code=test-code'
        );

        $callbackResponse
            ->assertOk()
            ->assertHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups')
            ->assertSee('Outlook Connected')
            ->assertSee('Outlook calendar connected successfully.');

        $this->assertStringContainsString(
            'window.opener.postMessage(payload, targetOrigin);',
            $callbackResponse->getContent()
        );

        $this->assertDatabaseHas('microsoft_calendar_connections', [
            'user_id' => $user->id,
            'microsoft_user_id' => 'microsoft-user-id',
            'microsoft_email' => 'staff@example.com',
            'microsoft_display_name' => 'Staff Example',
        ]);
    }

    public function test_microsoft_callback_shows_specific_invalid_state_message(): void
    {
        $this->configureMicrosoftOauth();

        $response = $this->get('/api/auth/microsoft/callback?state=not-a-valid-state&code=test-code');

        $response
            ->assertOk()
            ->assertSee('Outlook Connection Failed')
            ->assertSee('Microsoft authorization state is invalid or expired.')
            ->assertDontSee('Unable to connect Outlook right now. Please try again.');
    }

    public function test_microsoft_connect_url_can_be_created_without_app_key_when_client_secret_exists(): void
    {
        $this->configureMicrosoftOauth();
        config()->set('app.key', null);

        $user = User::factory()->create([
            'email' => 'staff@example.com',
            'role' => 'staff',
        ]);

        $response = $this
            ->withHeaders($this->authHeadersFor($user, 'oauth-no-app-key-token'))
            ->getJson('/api/auth/microsoft/connect-url?origin=' . urlencode('https://frontend.example.test'));

        $response->assertOk();
        $this->assertNotEmpty($response->json('url'));
    }

    public function test_microsoft_auth_callback_logs_in_existing_user_from_login_mode(): void
    {
        $this->configureMicrosoftOauth();

        $user = User::factory()->create([
            'name' => 'Staff Example',
            'email' => 'staff@example.com',
            'role' => 'staff',
        ]);

        $authResponse = $this->getJson(
            '/api/auth/microsoft/auth-url?origin=' . urlencode('https://frontend.example.test') . '&mode=login'
        );

        $authResponse->assertOk();
        parse_str((string) parse_url((string) $authResponse->json('url'), PHP_URL_QUERY), $query);
        $this->assertArrayHasKey('state', $query);

        Http::fake([
            'https://login.microsoftonline.com/*/oauth2/v2.0/token' => Http::response([
                'access_token' => 'access-token',
                'refresh_token' => 'refresh-token',
                'expires_in' => 3600,
                'scope' => 'openid profile offline_access User.Read Calendars.ReadWrite',
            ], 200),
            'https://graph.microsoft.com/v1.0/me*' => Http::response([
                'id' => 'microsoft-user-id',
                'displayName' => 'Staff Example',
                'mail' => 'staff@example.com',
                'userPrincipalName' => 'staff@example.com',
            ], 200),
        ]);

        $callbackResponse = $this->get(
            '/api/auth/microsoft/callback?state=' . urlencode((string) $query['state']) . '&code=test-code'
        );

        $callbackResponse
            ->assertOk()
            ->assertSee('Outlook sign-in successful.')
            ->assertSee('zenara:outlook-auth');

        $this->assertNotNull($user->fresh()?->api_token);
        $this->assertDatabaseHas('microsoft_calendar_connections', [
            'user_id' => $user->id,
            'microsoft_user_id' => 'microsoft-user-id',
            'microsoft_email' => 'staff@example.com',
        ]);
    }

    public function test_microsoft_auth_callback_can_create_a_new_user_from_signup_mode(): void
    {
        $this->configureMicrosoftOauth();

        $authResponse = $this->getJson(
            '/api/auth/microsoft/auth-url?origin=' . urlencode('https://frontend.example.test') . '&mode=signup&role=admin'
        );

        $authResponse->assertOk();
        parse_str((string) parse_url((string) $authResponse->json('url'), PHP_URL_QUERY), $query);
        $this->assertArrayHasKey('state', $query);

        Http::fake([
            'https://login.microsoftonline.com/*/oauth2/v2.0/token' => Http::response([
                'access_token' => 'access-token',
                'refresh_token' => 'refresh-token',
                'expires_in' => 3600,
                'scope' => 'openid profile offline_access User.Read Calendars.ReadWrite',
            ], 200),
            'https://graph.microsoft.com/v1.0/me*' => Http::response([
                'id' => 'new-microsoft-user-id',
                'displayName' => 'Outlook Admin',
                'mail' => 'new-admin@example.com',
                'userPrincipalName' => 'new-admin@example.com',
            ], 200),
        ]);

        $callbackResponse = $this->get(
            '/api/auth/microsoft/callback?state=' . urlencode((string) $query['state']) . '&code=test-code'
        );

        $callbackResponse
            ->assertOk()
            ->assertSee('Outlook account created successfully. You are now signed in.')
            ->assertSee('zenara:outlook-auth');

        $createdUser = User::query()->where('email', 'new-admin@example.com')->first();
        $this->assertNotNull($createdUser);
        $this->assertSame('admin', $createdUser?->role);
        $this->assertNotNull($createdUser?->api_token);

        $this->assertDatabaseHas('microsoft_calendar_connections', [
            'user_id' => $createdUser?->id,
            'microsoft_user_id' => 'new-microsoft-user-id',
            'microsoft_email' => 'new-admin@example.com',
        ]);
    }
}
