<?php

use App\Models\User;
use App\Services\CalendarReminderService;
use App\Services\FirestoreService;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('users:sync-firestore', function () {
    $firestore = app(FirestoreService::class);

    $total = 0;
    $synced = 0;
    $failed = 0;

    User::orderBy('id')->chunk(100, function ($users) use (&$total, &$synced, &$failed, $firestore) {
        foreach ($users as $user) {
            $total++;

            $payload = [
                'id' => (string) $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'has_active_session' => (bool) $user->api_token,
                'token_expires_at' => $user->api_token_expires_at?->toDateTimeString(),
                // Wipe any legacy sensitive fields previously synced
                'password' => null,
                'api_token' => null,
                'created_at' => $user->created_at?->toDateTimeString(),
                'updated_at' => $user->updated_at?->toDateTimeString(),
            ];

            $ok = $firestore->sync($user->id, $payload, 'users');
            if ($ok) {
                $synced++;
            } else {
                $failed++;
            }
        }
    });

    $this->info("Firestore users sync completed. Total: {$total}, Synced: {$synced}, Failed: {$failed}");
})->purpose('Backfill existing users into Firestore users collection');

Artisan::command('reminders:send-due', function () {
    $result = app(CalendarReminderService::class)->sendSameDayReminders();
    $this->info(sprintf(
        'Same-day reminders processed. Checked: %d, Sent: %d',
        (int) ($result['checked'] ?? 0),
        (int) ($result['sent'] ?? 0)
    ));
})->purpose('Send same-day appointment/follow-up reminders by email');

Schedule::command('reminders:send-due')
    ->everyTenMinutes()
    ->withoutOverlapping();
