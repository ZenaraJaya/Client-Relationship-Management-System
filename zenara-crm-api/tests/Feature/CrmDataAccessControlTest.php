<?php

namespace Tests\Feature;

use App\Models\Crm;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class CrmDataAccessControlTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Keep tests deterministic by forcing local-database CRM behavior.
        config()->set('services.firebase.credentials', null);
        config()->set('services.firebase.project_id', null);
        config()->set('services.google_calendar.credentials', null);
    }

    protected function authHeadersFor(User $user, string $plainToken): array
    {
        $user->forceFill([
            'api_token' => hash('sha256', $plainToken),
            'api_token_expires_at' => Carbon::now()->addHour(),
        ])->save();

        return [
            'Authorization' => 'Bearer ' . $plainToken,
        ];
    }

    public function test_index_only_returns_contacts_owned_by_authenticated_admin(): void
    {
        $adminA = User::factory()->create(['role' => 'admin']);
        $adminB = User::factory()->create(['role' => 'admin']);

        Crm::create([
            'user_id' => $adminA->id,
            'company_name' => 'Admin A Company',
        ]);
        Crm::create([
            'user_id' => $adminB->id,
            'company_name' => 'Admin B Company',
        ]);

        $response = $this->getJson(
            '/api/crms',
            $this->authHeadersFor($adminA, 'admin-a-index-token')
        );

        $response
            ->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.company_name', 'Admin A Company')
            ->assertJsonMissing(['company_name' => 'Admin B Company']);
    }

    public function test_admin_cannot_view_another_admin_contact(): void
    {
        $adminA = User::factory()->create(['role' => 'admin']);
        $adminB = User::factory()->create(['role' => 'admin']);

        $crm = Crm::create([
            'user_id' => $adminB->id,
            'company_name' => 'Private Company',
        ]);

        $this->getJson(
            '/api/crms/' . $crm->id,
            $this->authHeadersFor($adminA, 'admin-a-show-token')
        )
            ->assertNotFound()
            ->assertJson(['message' => 'Contact not found']);
    }

    public function test_admin_cannot_update_another_admin_contact(): void
    {
        $adminA = User::factory()->create(['role' => 'admin']);
        $adminB = User::factory()->create(['role' => 'admin']);

        $crm = Crm::create([
            'user_id' => $adminB->id,
            'company_name' => 'Original Name',
        ]);

        $this->putJson(
            '/api/crms/' . $crm->id,
            ['company_name' => 'Hacked Name'],
            $this->authHeadersFor($adminA, 'admin-a-update-token')
        )
            ->assertNotFound()
            ->assertJson(['message' => 'Contact not found']);

        $this->assertDatabaseHas('crms', [
            'id' => $crm->id,
            'company_name' => 'Original Name',
            'user_id' => $adminB->id,
        ]);
    }

    public function test_admin_cannot_delete_another_admin_contact(): void
    {
        $adminA = User::factory()->create(['role' => 'admin']);
        $adminB = User::factory()->create(['role' => 'admin']);

        $crm = Crm::create([
            'user_id' => $adminB->id,
            'company_name' => 'Do Not Delete',
        ]);

        $this->deleteJson(
            '/api/crms/' . $crm->id,
            [],
            $this->authHeadersFor($adminA, 'admin-a-delete-token')
        )
            ->assertNotFound()
            ->assertJson(['message' => 'Contact not found']);

        $this->assertDatabaseHas('crms', [
            'id' => $crm->id,
            'user_id' => $adminB->id,
        ]);
    }

    public function test_bulk_delete_only_deletes_owned_contacts(): void
    {
        $adminA = User::factory()->create(['role' => 'admin']);
        $adminB = User::factory()->create(['role' => 'admin']);

        $owned = Crm::create([
            'user_id' => $adminA->id,
            'company_name' => 'Owned Contact',
        ]);
        $other = Crm::create([
            'user_id' => $adminB->id,
            'company_name' => 'Other Contact',
        ]);

        $this->postJson(
            '/api/crms/bulk-delete',
            ['ids' => [$owned->id, $other->id]],
            $this->authHeadersFor($adminA, 'admin-a-bulk-delete-token')
        )
            ->assertOk()
            ->assertJson(['message' => 'Successfully deleted 1 contacts']);

        $this->assertDatabaseMissing('crms', ['id' => $owned->id]);
        $this->assertDatabaseHas('crms', ['id' => $other->id]);
    }
}
