<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class ProfileUpdateTest extends TestCase
{
    use RefreshDatabase;

    protected function authHeadersFor(User $user, string $plainToken = 'profile-token'): array
    {
        $user->forceFill([
            'api_token' => hash('sha256', $plainToken),
            'api_token_expires_at' => Carbon::now()->addHour(),
        ])->save();

        return [
            'Authorization' => 'Bearer ' . $plainToken,
        ];
    }

    public function test_staff_user_can_update_their_own_profile_photo_and_name_without_changing_email_or_role(): void
    {
        Storage::fake('public');

        $staff = User::factory()->create([
            'role' => 'staff',
            'password' => 'password',
            'email' => 'staff@example.com',
        ]);
        $photo = UploadedFile::fake()->createWithContent(
            'avatar.png',
            base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9sX6lz0AAAAASUVORK5CYII=')
        );

        $response = $this->withHeaders($this->authHeadersFor($staff, 'staff-profile-token'))->post(
            '/api/auth/profile',
            [
                '_method' => 'PUT',
                'name' => 'Staff Updated',
                'email' => 'staff-hijack@example.com',
                'password' => 'new-secret',
                'role' => 'admin',
                'profile_photo' => $photo,
            ]
        );

        $response
            ->assertOk()
            ->assertJsonPath('user.name', 'Staff Updated')
            ->assertJsonPath('user.email', 'staff@example.com')
            ->assertJsonPath('user.role', 'staff');

        $freshStaff = $staff->fresh();

        $this->assertSame('staff', $freshStaff?->role);
        $this->assertSame('Staff Updated', $freshStaff?->name);
        $this->assertSame('staff@example.com', $freshStaff?->email);
        $this->assertTrue(Hash::check('password', (string) $freshStaff?->password));
        $this->assertNotNull($freshStaff?->profile_photo_path);
        Storage::disk('public')->assertExists((string) $freshStaff?->profile_photo_path);
        $profilePhotoUrl = (string) $response->json('user.profile_photo_url');
        $this->assertStringContainsString('/api/auth/profile-photo/' . $staff->id, $profilePhotoUrl);

        $photoResponse = $this->get(parse_url($profilePhotoUrl, PHP_URL_PATH) ?? '');
        $photoResponse
            ->assertOk()
            ->assertHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    }

    public function test_profile_photo_url_prefers_forwarded_https_origin(): void
    {
        Storage::fake('public');

        $staff = User::factory()->create([
            'role' => 'staff',
            'password' => 'password',
            'email' => 'staff-https@example.com',
        ]);
        $photo = UploadedFile::fake()->createWithContent(
            'avatar.png',
            base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9sX6lz0AAAAASUVORK5CYII=')
        );

        $response = $this->withHeaders(array_merge(
            $this->authHeadersFor($staff, 'staff-profile-forwarded-token'),
            [
                'X-Forwarded-Proto' => 'https',
                'X-Forwarded-Host' => 'zenara-crm.onrender.com',
            ]
        ))->post('/api/auth/profile', [
            '_method' => 'PUT',
            'name' => 'Staff HTTPS',
            'profile_photo' => $photo,
        ]);

        $response->assertOk();
        $this->assertSame(
            'https://zenara-crm.onrender.com/api/auth/profile-photo/' . $staff->id . '?v=' . $staff->fresh()?->updated_at?->timestamp,
            $response->json('user.profile_photo_url')
        );
    }

    public function test_admin_user_can_update_their_own_profile(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'email' => 'admin@example.com',
        ]);

        $response = $this->putJson(
            '/api/auth/profile',
            [
                'name' => 'Admin Updated',
                'email' => 'admin-change@example.com',
            ],
            $this->authHeadersFor($admin, 'admin-profile-token')
        );

        $response
            ->assertOk()
            ->assertJsonPath('user.name', 'Admin Updated')
            ->assertJsonPath('user.email', 'admin@example.com')
            ->assertJsonPath('user.role', 'admin');

        $this->assertDatabaseHas('users', [
            'id' => $admin->id,
            'name' => 'Admin Updated',
            'email' => 'admin@example.com',
            'role' => 'admin',
        ]);
    }
}
