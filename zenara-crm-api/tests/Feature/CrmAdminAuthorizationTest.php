<?php

namespace Tests\Feature;

use App\Models\Crm;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class CrmAdminAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    protected function authHeadersFor(User $user, string $plainToken = 'test-token'): array
    {
        $user->forceFill([
            'api_token' => hash('sha256', $plainToken),
            'api_token_expires_at' => Carbon::now()->addHour(),
        ])->save();

        return [
            'Authorization' => 'Bearer ' . $plainToken,
        ];
    }

    public function test_staff_user_cannot_update_a_crm_contact(): void
    {
        $staff = User::factory()->create([
            'role' => 'staff',
        ]);
        $crm = Crm::create([
            'company_name' => 'Original Company',
        ]);

        $response = $this->putJson(
            '/api/crms/' . $crm->id,
            ['company_name' => 'Updated Company'],
            $this->authHeadersFor($staff, 'staff-update-token')
        );

        $response
            ->assertForbidden()
            ->assertJson(['message' => 'Only admin users can edit contacts.']);

        $this->assertDatabaseHas('crms', [
            'id' => $crm->id,
            'company_name' => 'Original Company',
        ]);
    }

    public function test_staff_user_cannot_delete_a_crm_contact(): void
    {
        $staff = User::factory()->create([
            'role' => 'staff',
        ]);
        $crm = Crm::create([
            'company_name' => 'Delete Protected Company',
        ]);

        $response = $this->deleteJson(
            '/api/crms/' . $crm->id,
            [],
            $this->authHeadersFor($staff, 'staff-delete-token')
        );

        $response
            ->assertForbidden()
            ->assertJson(['message' => 'Only admin users can delete contacts.']);

        $this->assertDatabaseHas('crms', [
            'id' => $crm->id,
        ]);
    }

    public function test_admin_user_can_update_and_delete_a_crm_contact(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
        ]);
        $crm = Crm::create([
            'company_name' => 'Admin Managed Company',
        ]);

        $updateResponse = $this->putJson(
            '/api/crms/' . $crm->id,
            ['company_name' => 'Admin Updated Company'],
            $this->authHeadersFor($admin, 'admin-token')
        );

        $updateResponse
            ->assertOk()
            ->assertJsonPath('company_name', 'Admin Updated Company');

        $this->assertDatabaseHas('crms', [
            'id' => $crm->id,
            'company_name' => 'Admin Updated Company',
        ]);

        $deleteResponse = $this->deleteJson(
            '/api/crms/' . $crm->id,
            [],
            ['Authorization' => 'Bearer admin-token']
        );

        $deleteResponse->assertNoContent();

        $this->assertDatabaseMissing('crms', [
            'id' => $crm->id,
        ]);
    }
}
