<?php

namespace Tests\Feature;

use App\Models\Crm;
use App\Models\User;
use App\Services\CalendarReminderService;
use App\Services\MicrosoftCalendarOAuthService;
use App\Services\OutboundEmailService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class CrmCalendarSyncWarningTest extends TestCase
{
    use RefreshDatabase;

    protected function authHeadersFor(User $user, string $plainToken = 'calendar-warning-token'): array
    {
        $user->forceFill([
            'api_token' => hash('sha256', $plainToken),
            'api_token_expires_at' => Carbon::now()->addHour(),
        ])->save();

        return [
            'Authorization' => 'Bearer ' . $plainToken,
        ];
    }

    public function test_crm_store_returns_calendar_sync_warning_when_save_succeeds_but_outlook_sync_fails(): void
    {
        $user = User::factory()->create([
            'role' => 'staff',
            'email' => 'staff@example.com',
        ]);

        $warningMessage = 'CRM saved, but Outlook sync failed for staff@example.com: simulated failure';

        $this->app->instance(
            CalendarReminderService::class,
            new class(new OutboundEmailService(), new MicrosoftCalendarOAuthService(), $warningMessage) extends CalendarReminderService
            {
                public function __construct(
                    OutboundEmailService $outboundEmail,
                    MicrosoftCalendarOAuthService $microsoftOauth,
                    protected string $warningMessage
                ) {
                    parent::__construct($outboundEmail, $microsoftOauth);
                }

                public function syncForCrm(Crm $crm, bool $sendScheduleNotifications = true, ?User $actor = null): void
                {
                    $this->resetLastSyncWarnings();
                    $this->addSyncWarning($this->warningMessage);
                }

                public function notifyScheduleChangesFromPayload(array $before, array $after): void
                {
                }
            }
        );

        $response = $this->postJson(
            '/api/crms',
            [
                'company_name' => 'Acme Corp',
                'appointment' => Carbon::now()->addDay()->toIso8601String(),
            ],
            $this->authHeadersFor($user, 'calendar-warning-store-token')
        );

        $response
            ->assertCreated()
            ->assertJsonPath('company_name', 'Acme Corp')
            ->assertJsonPath('calendar_sync_warning', $warningMessage)
            ->assertJsonCount(1, 'calendar_sync_warnings');

        $this->assertDatabaseHas('crms', [
            'company_name' => 'Acme Corp',
            'user_id' => $user->id,
        ]);
    }
}
