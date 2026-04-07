<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
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

    public function test_staff_user_can_update_their_own_profile_without_changing_role(): void
    {
        $staff = User::factory()->create([
            'role' => 'staff',
            'password' => 'password',
        ]);

        $response = $this->putJson(
            '/api/auth/profile',
            [
                'name' => 'Staff Updated',
                'email' => 'staff-updated@example.com',
                'password' => 'new-secret',
                'password_confirmation' => 'new-secret',
                'role' => 'admin',
            ],
            $this->authHeadersFor($staff, 'staff-profile-token')
        );

        $response
            ->assertOk()
            ->assertJsonPath('user.name', 'Staff Updated')
            ->assertJsonPath('user.email', 'staff-updated@example.com')
            ->assertJsonPath('user.role', 'staff');

        $freshStaff = $staff->fresh();

        $this->assertSame('staff', $freshStaff?->role);
        $this->assertSame('Staff Updated', $freshStaff?->name);
        $this->assertSame('staff-updated@example.com', $freshStaff?->email);
        $this->assertTrue(Hash::check('new-secret', (string) $freshStaff?->password));
    }

    public function test_admin_user_can_update_their_own_profile(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
        ]);

        $response = $this->putJson(
            '/api/auth/profile',
            [
                'name' => 'Admin Updated',
                'email' => 'admin-updated@example.com',
            ],
            $this->authHeadersFor($admin, 'admin-profile-token')
        );

        $response
            ->assertOk()
            ->assertJsonPath('user.name', 'Admin Updated')
            ->assertJsonPath('user.email', 'admin-updated@example.com')
            ->assertJsonPath('user.role', 'admin');

        $this->assertDatabaseHas('users', [
            'id' => $admin->id,
            'name' => 'Admin Updated',
            'email' => 'admin-updated@example.com',
            'role' => 'admin',
        ]);
    }
}
