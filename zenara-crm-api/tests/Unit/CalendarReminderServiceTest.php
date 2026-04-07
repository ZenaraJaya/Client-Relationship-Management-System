<?php

namespace Tests\Unit;

use App\Models\Crm;
use App\Models\MicrosoftCalendarConnection;
use App\Models\User;
use App\Services\CalendarReminderService;
use App\Services\MicrosoftCalendarOAuthService;
use App\Services\OutboundEmailService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class CalendarReminderServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function makeService(): CalendarReminderService
    {
        return new class(new OutboundEmailService(), new MicrosoftCalendarOAuthService()) extends CalendarReminderService
        {
            public function microsoftAttendeesFor(Crm $crm): array
            {
                return $this->resolveMicrosoftCalendarAttendeeEmails($crm);
            }

            public function personalSyncUserIdsFor(Crm $crm, ?User $actor = null): array
            {
                return array_keys($this->resolvePersonalMicrosoftSyncUsers($crm, $actor));
            }
        };
    }

    protected function createMicrosoftConnection(User $user): void
    {
        MicrosoftCalendarConnection::create([
            'user_id' => $user->id,
            'microsoft_user_id' => 'ms-' . $user->id,
            'microsoft_email' => $user->email,
            'microsoft_display_name' => $user->name,
            'access_token' => 'token-' . $user->id,
            'refresh_token' => 'refresh-' . $user->id,
            'scopes' => 'openid profile offline_access User.Read Calendars.ReadWrite',
            'access_token_expires_at' => Carbon::now()->addHour(),
            'connected_at' => Carbon::now(),
            'last_synced_at' => Carbon::now(),
        ]);
    }

    public function test_microsoft_attendees_include_internal_users_but_exclude_the_client(): void
    {
        config()->set('services.calendar_reminders.attendee_email', 'shared@example.com');
        config()->set('services.calendar_reminders.sync_owner_as_attendee', true);
        config()->set('services.calendar_reminders.sync_auth_user_as_attendee', true);
        config()->set('services.calendar_reminders.sync_auth_admin_only', false);
        config()->set('services.calendar_reminders.sync_client_as_attendee', true);

        $owner = User::factory()->create([
            'role' => 'staff',
            'email' => 'staff@example.com',
        ]);
        $admin = User::factory()->create([
            'role' => 'admin',
            'email' => 'admin@example.com',
        ]);
        $crm = Crm::factory()->create([
            'user_id' => $owner->id,
            'email' => 'client@example.com',
        ]);

        $this->actingAs($admin);

        $attendees = $this->makeService()->microsoftAttendeesFor($crm);

        $this->assertSame(
            ['shared@example.com', 'staff@example.com', 'admin@example.com'],
            $attendees
        );
        $this->assertNotContains('client@example.com', $attendees);
    }

    public function test_personal_outlook_sync_targets_the_crm_owner_and_current_actor(): void
    {
        $owner = User::factory()->create([
            'role' => 'staff',
            'email' => 'staff@example.com',
        ]);
        $admin = User::factory()->create([
            'role' => 'admin',
            'email' => 'admin@example.com',
        ]);
        $crm = Crm::factory()->create([
            'user_id' => $owner->id,
            'email' => 'client@example.com',
        ]);

        $userIds = $this->makeService()->personalSyncUserIdsFor($crm, $admin);

        $this->assertSame([$owner->id, $admin->id], $userIds);
    }

    public function test_sync_for_crm_creates_internal_outlook_events_without_inviting_the_client(): void
    {
        config()->set('services.calendar_reminders.enabled', true);
        config()->set('services.google_calendar.calendar_id', null);
        config()->set('services.google_calendar.credentials', null);
        config()->set('services.microsoft_graph.enabled', false);
        config()->set('services.microsoft_graph.calendar_user_id', null);

        $owner = User::factory()->create([
            'role' => 'staff',
            'email' => 'staff@example.com',
        ]);
        $admin = User::factory()->create([
            'role' => 'admin',
            'email' => 'admin@example.com',
        ]);

        $this->createMicrosoftConnection($owner);
        $this->createMicrosoftConnection($admin);

        $crm = Crm::factory()->create([
            'user_id' => $owner->id,
            'email' => 'client@example.com',
            'appointment' => Carbon::now()->addDay(),
            'follow_up' => Carbon::now()->addDays(2),
        ]);

        Http::fake([
            'https://graph.microsoft.com/v1.0/me/calendar/events' => Http::response(['id' => 'evt-123'], 201),
            'https://graph.microsoft.com/v1.0/me/events/*' => Http::response([], 200),
        ]);

        $service = new CalendarReminderService(new OutboundEmailService(), new MicrosoftCalendarOAuthService());
        $service->syncForCrm($crm, false, $admin);

        $this->assertDatabaseHas('crm_calendar_events', [
            'crm_id' => $crm->id,
            'user_id' => $owner->id,
            'provider' => 'microsoft-user',
            'event_type' => 'appointment',
        ]);
        $this->assertDatabaseHas('crm_calendar_events', [
            'crm_id' => $crm->id,
            'user_id' => $owner->id,
            'provider' => 'microsoft-user',
            'event_type' => 'follow_up',
        ]);
        $this->assertDatabaseHas('crm_calendar_events', [
            'crm_id' => $crm->id,
            'user_id' => $admin->id,
            'provider' => 'microsoft-user',
            'event_type' => 'appointment',
        ]);
        $this->assertDatabaseHas('crm_calendar_events', [
            'crm_id' => $crm->id,
            'user_id' => $admin->id,
            'provider' => 'microsoft-user',
            'event_type' => 'follow_up',
        ]);

        Http::assertSentCount(4);
        Http::assertSent(
            fn ($request) => $request->method() === 'POST'
                && $request->url() === 'https://graph.microsoft.com/v1.0/me/calendar/events'
                && !str_contains($request->body(), '"attendees"')
        );
    }
}
