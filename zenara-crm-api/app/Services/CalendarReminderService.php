<?php

namespace App\Services;

use App\Models\Crm;
use App\Models\User;
use Google\Auth\Credentials\ServiceAccountCredentials;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

class CalendarReminderService
{
    protected ?string $googleAccessToken = null;
    protected ?string $microsoftAccessToken = null;
    protected ?bool $timedReminderColumnsReady = null;

    public function __construct(
        protected OutboundEmailService $outboundEmail
    ) {
    }

    public function syncForCrm(Crm $crm, bool $sendScheduleNotifications = true): void
    {
        $calendarSyncEnabled = (bool) config('services.calendar_reminders.enabled');

        $appointmentChanged = $crm->wasRecentlyCreated
            ? (bool) $crm->appointment
            : $crm->wasChanged('appointment');
        $followUpChanged = $crm->wasRecentlyCreated
            ? (bool) $crm->follow_up
            : $crm->wasChanged('follow_up');

        if ($calendarSyncEnabled) {
            $updates = [
                'appointment_google_event_id' => $this->syncGoogleEvent(
                    $crm,
                    'appointment',
                    $crm->appointment,
                    $crm->appointment_google_event_id
                ),
                'appointment_ms_event_id' => $this->syncMicrosoftEvent(
                    $crm,
                    'appointment',
                    $crm->appointment,
                    $crm->appointment_ms_event_id
                ),
                'follow_up_google_event_id' => $this->syncGoogleEvent(
                    $crm,
                    'follow_up',
                    $crm->follow_up,
                    $crm->follow_up_google_event_id
                ),
                'follow_up_ms_event_id' => $this->syncMicrosoftEvent(
                    $crm,
                    'follow_up',
                    $crm->follow_up,
                    $crm->follow_up_ms_event_id
                ),
            ];

            $this->persistEventIds($crm, $updates);
        }

        if ($sendScheduleNotifications) {
            $this->sendScheduleNotificationIfNeeded($crm, 'appointment', $crm->appointment, $appointmentChanged);
            $this->sendScheduleNotificationIfNeeded($crm, 'follow_up', $crm->follow_up, $followUpChanged);
        }
        $this->resetTimedReminderMarkersIfScheduleChanged($crm, $appointmentChanged, $followUpChanged);
    }

    /**
     * Send notification emails when appointment/follow-up fields change in
     * payloads that may come from Firestore-only records.
     */
    public function notifyScheduleChangesFromPayload(array $before, array $after): void
    {
        if (!config('services.calendar_reminders.email_notifications_enabled', true)) {
            return;
        }

        $crm = new Crm();
        $crm->forceFill($after);

        if (isset($after['id'])) {
            $crm->id = $after['id'];
        } elseif (isset($before['id'])) {
            $crm->id = $before['id'];
        }

        $appointmentChanged = ($before['appointment'] ?? null) !== ($after['appointment'] ?? null);
        $followUpChanged = ($before['follow_up'] ?? null) !== ($after['follow_up'] ?? null);

        $this->sendScheduleNotificationIfNeeded($crm, 'appointment', $after['appointment'] ?? null, $appointmentChanged);
        $this->sendScheduleNotificationIfNeeded($crm, 'follow_up', $after['follow_up'] ?? null, $followUpChanged);
    }

    /**
     * Send time-based reminders:
     * - X minutes before schedule (default 15)
     * - At schedule time (with a short grace window)
     */
    public function sendTimedReminders(): array
    {
        if (!config('services.calendar_reminders.email_notifications_enabled', true)) {
            return ['checked' => 0, 'sent' => 0];
        }

        if (!$this->hasTimedReminderColumns()) {
            Log::warning('Timed reminders skipped: required columns are missing. Run latest migrations.');
            return ['checked' => 0, 'sent' => 0];
        }

        $tz = config('app.timezone', 'UTC');
        $now = Carbon::now($tz);
        $preMinutes = max(1, (int) config('services.calendar_reminders.pre_reminder_minutes', 15));
        $dueGraceMinutes = max(1, (int) config('services.calendar_reminders.due_reminder_grace_minutes', 5));

        $queryStart = $now->copy()->subMinutes($dueGraceMinutes);
        $queryEnd = $now->copy()->addMinutes($preMinutes + 1);

        $crms = Crm::query()
            ->where(function ($query) use ($queryStart, $queryEnd): void {
                $query->whereBetween('appointment', [$queryStart, $queryEnd])
                    ->orWhereBetween('follow_up', [$queryStart, $queryEnd]);
            })
            ->get();

        $checked = 0;
        $sent = 0;

        foreach ($crms as $crm) {
            $checked++;
            $sent += $this->sendTimedReminderIfNeeded(
                $crm,
                'appointment',
                $crm->appointment,
                'appointment_pre_reminder_for_at',
                'appointment_due_reminder_for_at',
                $preMinutes,
                $dueGraceMinutes,
                $now
            );
            $sent += $this->sendTimedReminderIfNeeded(
                $crm,
                'follow_up',
                $crm->follow_up,
                'follow_up_pre_reminder_for_at',
                'follow_up_due_reminder_for_at',
                $preMinutes,
                $dueGraceMinutes,
                $now
            );
        }

        return ['checked' => $checked, 'sent' => $sent];
    }

    /**
     * Backward-compatible alias.
     */
    public function sendSameDayReminders(): array
    {
        return $this->sendTimedReminders();
    }

    public function removeForCrm(Crm $crm): void
    {
        if (!config('services.calendar_reminders.enabled')) {
            return;
        }

        $updates = [
            'appointment_google_event_id' => $this->clearGoogleEvent($crm->appointment_google_event_id),
            'appointment_ms_event_id' => $this->clearMicrosoftEvent($crm->appointment_ms_event_id),
            'follow_up_google_event_id' => $this->clearGoogleEvent($crm->follow_up_google_event_id),
            'follow_up_ms_event_id' => $this->clearMicrosoftEvent($crm->follow_up_ms_event_id),
        ];

        $this->persistEventIds($crm, $updates);
    }

    protected function syncGoogleEvent(Crm $crm, string $type, $dateValue, ?string $existingEventId): ?string
    {
        if (!$this->isGoogleConfigured()) {
            return $existingEventId;
        }

        if (!$dateValue) {
            return $this->clearGoogleEvent($existingEventId);
        }

        $token = $this->getGoogleAccessToken();
        if (!$token) {
            return $existingEventId;
        }

        $payload = $this->buildGooglePayload($crm, $type, $dateValue);
        $calendarId = rawurlencode((string) config('services.google_calendar.calendar_id'));
        $baseUrl = "https://www.googleapis.com/calendar/v3/calendars/{$calendarId}/events";

        if ($existingEventId) {
            $updateResponse = $this->calendarHttp()->withToken($token)
                ->put("{$baseUrl}/" . rawurlencode($existingEventId) . '?sendUpdates=all', $payload);

            if ($updateResponse->successful()) {
                return $existingEventId;
            }
        }

        $createResponse = $this->calendarHttp()->withToken($token)->post("{$baseUrl}?sendUpdates=all", $payload);
        if ($createResponse->successful()) {
            return $createResponse->json('id');
        }

        Log::warning('Google Calendar event sync failed.', [
            'crm_id' => $crm->id,
            'type' => $type,
            'status' => $createResponse->status(),
            'response' => $createResponse->body(),
        ]);

        return $existingEventId;
    }

    protected function syncMicrosoftEvent(Crm $crm, string $type, $dateValue, ?string $existingEventId): ?string
    {
        if (!$this->isMicrosoftConfigured()) {
            return $existingEventId;
        }

        if (!$dateValue) {
            return $this->clearMicrosoftEvent($existingEventId);
        }

        $token = $this->getMicrosoftAccessToken();
        if (!$token) {
            return $existingEventId;
        }

        $payload = $this->buildMicrosoftPayload($crm, $type, $dateValue);
        $userId = rawurlencode((string) config('services.microsoft_graph.calendar_user_id'));
        $baseUrl = "https://graph.microsoft.com/v1.0/users/{$userId}/calendar/events";

        if ($existingEventId) {
            $updateResponse = $this->calendarHttp()->withToken($token)
                ->patch("{$baseUrl}/" . rawurlencode($existingEventId), $payload);

            if ($updateResponse->successful()) {
                return $existingEventId;
            }
        }

        $createResponse = $this->calendarHttp()->withToken($token)->post($baseUrl, $payload);
        if ($createResponse->successful()) {
            return $createResponse->json('id');
        }

        Log::warning('Microsoft Calendar event sync failed.', [
            'crm_id' => $crm->id,
            'type' => $type,
            'status' => $createResponse->status(),
            'response' => $createResponse->body(),
        ]);

        return $existingEventId;
    }

    protected function clearGoogleEvent(?string $eventId): ?string
    {
        if (!$eventId) {
            return null;
        }

        if (!$this->isGoogleConfigured()) {
            return $eventId;
        }

        $token = $this->getGoogleAccessToken();
        if (!$token) {
            return $eventId;
        }

        $calendarId = rawurlencode((string) config('services.google_calendar.calendar_id'));
        $url = "https://www.googleapis.com/calendar/v3/calendars/{$calendarId}/events/" . rawurlencode($eventId);
        $response = $this->calendarHttp()->withToken($token)->delete($url);

        if ($response->successful() || $response->status() === 404) {
            return null;
        }

        return $eventId;
    }

    protected function clearMicrosoftEvent(?string $eventId): ?string
    {
        if (!$eventId) {
            return null;
        }

        if (!$this->isMicrosoftConfigured()) {
            return $eventId;
        }

        $token = $this->getMicrosoftAccessToken();
        if (!$token) {
            return $eventId;
        }

        $userId = rawurlencode((string) config('services.microsoft_graph.calendar_user_id'));
        $url = "https://graph.microsoft.com/v1.0/users/{$userId}/calendar/events/" . rawurlencode($eventId);
        $response = $this->calendarHttp()->withToken($token)->delete($url);

        if ($response->successful() || $response->status() === 404) {
            return null;
        }

        return $eventId;
    }

    protected function buildGooglePayload(Crm $crm, string $type, $dateValue): array
    {
        [$start, $end] = $this->buildEventWindow($dateValue);
        $attendeeEmail = config('services.calendar_reminders.attendee_email');
        $payload = [
            'summary' => $this->buildEventTitle($crm, $type),
            'description' => $this->buildEventDescription($crm, $type),
            'start' => [
                'dateTime' => $start->toRfc3339String(),
                'timeZone' => $start->timezoneName,
            ],
            'end' => [
                'dateTime' => $end->toRfc3339String(),
                'timeZone' => $end->timezoneName,
            ],
            'reminders' => [
                'useDefault' => false,
                'overrides' => [
                    ['method' => 'email', 'minutes' => 60],
                    ['method' => 'popup', 'minutes' => 60],
                ],
            ],
        ];

        if ($attendeeEmail) {
            $payload['attendees'] = [['email' => $attendeeEmail]];
        }

        return $payload;
    }

    protected function buildMicrosoftPayload(Crm $crm, string $type, $dateValue): array
    {
        [$start, $end] = $this->buildEventWindow($dateValue);
        $attendeeEmail = config('services.calendar_reminders.attendee_email');
        $payload = [
            'subject' => $this->buildEventTitle($crm, $type),
            'body' => [
                'contentType' => 'Text',
                'content' => $this->buildEventDescription($crm, $type),
            ],
            'start' => [
                'dateTime' => $start->copy()->setTimezone('UTC')->format('Y-m-d\TH:i:s'),
                'timeZone' => 'UTC',
            ],
            'end' => [
                'dateTime' => $end->copy()->setTimezone('UTC')->format('Y-m-d\TH:i:s'),
                'timeZone' => 'UTC',
            ],
            'isReminderOn' => true,
            'reminderMinutesBeforeStart' => 60,
            'showAs' => 'busy',
        ];

        if ($attendeeEmail) {
            $payload['attendees'] = [[
                'emailAddress' => [
                    'address' => $attendeeEmail,
                    'name' => $attendeeEmail,
                ],
                'type' => 'required',
            ]];
        }

        return $payload;
    }

    protected function buildEventWindow($dateValue): array
    {
        $tz = config('app.timezone', 'UTC');
        $defaultHour = (int) config('services.calendar_reminders.default_hour', 9);
        $durationMinutes = max(5, (int) config('services.calendar_reminders.default_duration_minutes', 30));

        $start = $dateValue instanceof Carbon ? $dateValue->copy() : Carbon::parse($dateValue, $tz);
        $start->setTimezone($tz);

        if ($start->hour === 0 && $start->minute === 0 && $start->second === 0) {
            $start->setTime($defaultHour, 0, 0);
        }

        $end = $start->copy()->addMinutes($durationMinutes);

        return [$start, $end];
    }

    protected function buildEventTitle(Crm $crm, string $type): string
    {
        $label = $type === 'follow_up' ? 'Follow Up' : 'Appointment';
        return trim(($crm->company_name ?: 'CRM Contact') . " - {$label}");
    }

    protected function buildEventDescription(Crm $crm, string $type): string
    {
        $label = $type === 'follow_up' ? 'Follow Up Reminder' : 'Appointment Reminder';
        $parts = [
            $label,
            "Company: " . ($crm->company_name ?: '-'),
            "Contact: " . ($crm->contact_person ?: '-'),
            "Phone: " . ($crm->phone ?: '-'),
            "Email: " . ($crm->email ?: '-'),
            "Remarks: " . ($crm->remarks ?: '-'),
        ];

        return implode("\n", $parts);
    }

    protected function sendScheduleNotificationIfNeeded(Crm $crm, string $type, $dateValue, bool $changed): void
    {
        if (!$changed || !config('services.calendar_reminders.email_notifications_enabled', true)) {
            return;
        }

        $recipients = $this->resolveNotificationRecipients($crm);
        if ($recipients === []) {
            Log::warning('Email notification skipped: no valid recipients resolved.', [
                'crm_id' => $crm->id,
                'type' => $type,
            ]);
            return;
        }

        $label = $type === 'follow_up' ? 'Follow Up' : 'Appointment';
        $company = $crm->company_name ?: 'CRM Contact';

        if ($dateValue) {
            [$start, $end] = $this->buildEventWindow($dateValue);
            $subject = "[Zenara CRM] {$label} Scheduled - {$company}";
            $summary = "{$label} has been scheduled/updated.";
            $details = [
                "Company: {$company}",
                "Contact: " . ($crm->contact_person ?: '-'),
                "Start: " . $start->toDayDateTimeString(),
                "End: " . $end->toDayDateTimeString(),
                "Timezone: " . $start->timezoneName,
                "Status: " . ($crm->status ?: '-'),
            ];
        } else {
            $subject = "[Zenara CRM] {$label} Cancelled - {$company}";
            $summary = "{$label} has been removed/cancelled.";
            $details = [
                "Company: {$company}",
                "Contact: " . ($crm->contact_person ?: '-'),
                "Status: " . ($crm->status ?: '-'),
            ];
        }

        $body = $this->buildPlainNotificationBody($summary, $details);
        $html = null;
        try {
            $html = $this->buildNotificationHtml($subject, $summary, $details);
        } catch (\Throwable $e) {
            Log::warning('Failed to render reminder HTML template. Falling back to plain text email.', [
                'crm_id' => $crm->id,
                'type' => $type,
                'error' => $e->getMessage(),
            ]);
        }

        Log::info('Dispatching schedule notification email.', [
            'crm_id' => $crm->id,
            'type' => $type,
            'recipients_count' => count($recipients),
            'recipients' => $recipients,
            'delivery_mode' => $this->outboundEmail->deliveryMode(),
        ]);

        foreach ($recipients as $recipient) {
            try {
                $this->outboundEmail->send($recipient, $subject, $body, $html);
            } catch (\Throwable $e) {
                Log::warning('Failed to send calendar notification email.', [
                    'crm_id' => $crm->id,
                    'type' => $type,
                    'recipient' => $recipient,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }

    protected function sendTimedReminderIfNeeded(
        Crm $crm,
        string $type,
        $dateValue,
        string $preColumn,
        string $dueColumn,
        int $preMinutes,
        int $dueGraceMinutes,
        Carbon $now
    ): int {
        if (!$dateValue) {
            return 0;
        }

        [$start, $end] = $this->buildEventWindow($dateValue);
        $nowInTz = $now->copy()->setTimezone($start->timezoneName);

        $recipients = $this->resolveNotificationRecipients($crm);
        if ($recipients === []) {
            return 0;
        }

        $sent = 0;
        $sent += $this->sendPreReminderIfNeeded($crm, $type, $start, $end, $recipients, $preColumn, $preMinutes, $nowInTz);
        $sent += $this->sendDueReminderIfNeeded($crm, $type, $start, $end, $recipients, $dueColumn, $dueGraceMinutes, $nowInTz);

        return $sent;
    }

    protected function sendPreReminderIfNeeded(
        Crm $crm,
        string $type,
        Carbon $start,
        Carbon $end,
        array $recipients,
        string $preColumn,
        int $preMinutes,
        Carbon $now
    ): int {
        $preReminderTime = $start->copy()->subMinutes($preMinutes);
        if ($now->lt($preReminderTime) || $now->gte($start)) {
            return 0;
        }

        if ($this->matchesReminderMarker($crm->{$preColumn}, $start)) {
            return 0;
        }

        $label = $type === 'follow_up' ? 'Follow Up' : 'Appointment';
        $company = $crm->company_name ?: 'CRM Contact';
        $subject = "[Zenara CRM] Reminder in {$preMinutes} Minutes - {$label} - {$company}";
        $summary = "{$label} is scheduled in {$preMinutes} minutes.";
        $details = [
            "Company: {$company}",
            "Contact: " . ($crm->contact_person ?: '-'),
            "Start: " . $start->toDayDateTimeString(),
            "End: " . $end->toDayDateTimeString(),
            "Timezone: " . $start->timezoneName,
            "Status: " . ($crm->status ?: '-'),
        ];

        $this->dispatchTimedReminder($crm, $type, $recipients, $subject, $summary, $details, 'pre-time');

        $crm->{$preColumn} = $this->buildReminderMarker($start);
        $crm->saveQuietly();

        return 1;
    }

    protected function sendDueReminderIfNeeded(
        Crm $crm,
        string $type,
        Carbon $start,
        Carbon $end,
        array $recipients,
        string $dueColumn,
        int $dueGraceMinutes,
        Carbon $now
    ): int {
        $dueWindowEnd = $start->copy()->addMinutes($dueGraceMinutes);
        if ($now->lt($start) || $now->gt($dueWindowEnd)) {
            return 0;
        }

        if ($this->matchesReminderMarker($crm->{$dueColumn}, $start)) {
            return 0;
        }

        $label = $type === 'follow_up' ? 'Follow Up' : 'Appointment';
        $company = $crm->company_name ?: 'CRM Contact';
        $subject = "[Zenara CRM] Reminder Now - {$label} - {$company}";
        $summary = "{$label} is due now.";
        $details = [
            "Company: {$company}",
            "Contact: " . ($crm->contact_person ?: '-'),
            "Start: " . $start->toDayDateTimeString(),
            "End: " . $end->toDayDateTimeString(),
            "Timezone: " . $start->timezoneName,
            "Status: " . ($crm->status ?: '-'),
        ];

        $this->dispatchTimedReminder($crm, $type, $recipients, $subject, $summary, $details, 'at-time');

        $crm->{$dueColumn} = $this->buildReminderMarker($start);
        $crm->saveQuietly();

        return 1;
    }

    protected function dispatchTimedReminder(
        Crm $crm,
        string $type,
        array $recipients,
        string $subject,
        string $summary,
        array $details,
        string $stage
    ): void {
        $textBody = $this->buildPlainNotificationBody($summary, $details);
        $htmlBody = null;
        try {
            $htmlBody = $this->buildNotificationHtml($subject, $summary, $details);
        } catch (\Throwable $e) {
            Log::warning('Failed to render timed reminder HTML template. Falling back to plain text email.', [
                'crm_id' => $crm->id,
                'type' => $type,
                'stage' => $stage,
                'error' => $e->getMessage(),
            ]);
        }

        Log::info('Dispatching timed reminder email.', [
            'crm_id' => $crm->id,
            'type' => $type,
            'stage' => $stage,
            'recipients_count' => count($recipients),
            'recipients' => $recipients,
            'delivery_mode' => $this->outboundEmail->deliveryMode(),
        ]);

        foreach ($recipients as $recipient) {
            try {
                $this->outboundEmail->send($recipient, $subject, $textBody, $htmlBody);
            } catch (\Throwable $e) {
                Log::warning('Failed to send timed reminder email.', [
                    'crm_id' => $crm->id,
                    'type' => $type,
                    'stage' => $stage,
                    'recipient' => $recipient,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }

    protected function buildReminderMarker(Carbon $eventStart): string
    {
        return $eventStart->copy()->utc()->toDateTimeString();
    }

    protected function matchesReminderMarker($storedMarker, Carbon $eventStart): bool
    {
        if (!$storedMarker) {
            return false;
        }

        try {
            return Carbon::parse($storedMarker)->utc()->toDateTimeString() === $this->buildReminderMarker($eventStart);
        } catch (\Throwable) {
            return false;
        }
    }

    protected function resetTimedReminderMarkersIfScheduleChanged(Crm $crm, bool $appointmentChanged, bool $followUpChanged): void
    {
        if (!$this->hasTimedReminderColumns()) {
            return;
        }

        $dirty = false;

        if ($appointmentChanged) {
            if ($crm->appointment_pre_reminder_for_at !== null) {
                $crm->appointment_pre_reminder_for_at = null;
                $dirty = true;
            }
            if ($crm->appointment_due_reminder_for_at !== null) {
                $crm->appointment_due_reminder_for_at = null;
                $dirty = true;
            }
            if ($crm->appointment_reminder_sent_on !== null) {
                $crm->appointment_reminder_sent_on = null;
                $dirty = true;
            }
        }

        if ($followUpChanged) {
            if ($crm->follow_up_pre_reminder_for_at !== null) {
                $crm->follow_up_pre_reminder_for_at = null;
                $dirty = true;
            }
            if ($crm->follow_up_due_reminder_for_at !== null) {
                $crm->follow_up_due_reminder_for_at = null;
                $dirty = true;
            }
            if ($crm->follow_up_reminder_sent_on !== null) {
                $crm->follow_up_reminder_sent_on = null;
                $dirty = true;
            }
        }

        if ($dirty) {
            $crm->saveQuietly();
        }
    }

    protected function hasTimedReminderColumns(): bool
    {
        if ($this->timedReminderColumnsReady !== null) {
            return $this->timedReminderColumnsReady;
        }

        try {
            $this->timedReminderColumnsReady = Schema::hasColumns('crms', [
                'appointment_pre_reminder_for_at',
                'appointment_due_reminder_for_at',
                'follow_up_pre_reminder_for_at',
                'follow_up_due_reminder_for_at',
            ]);
        } catch (\Throwable) {
            $this->timedReminderColumnsReady = false;
        }

        return $this->timedReminderColumnsReady;
    }

    protected function buildPlainNotificationBody(string $summary, array $details): string
    {
        return implode("\n", array_merge([$summary], $details));
    }

    protected function buildNotificationHtml(string $subject, string $summary, array $details): string
    {
        return view('emails.crm-reminder', [
            'subject' => $subject,
            'summary' => $summary,
            'details' => $details,
        ])->render();
    }

    protected function resolveNotificationRecipients(Crm $crm): array
    {
        $candidates = [];

        // Admin recipients (explicitly configured)
        $candidates = array_merge(
            $candidates,
            $this->parseEmailList((string) config('services.calendar_reminders.admin_emails'))
        );

        // Backward-compatible single admin recipient setting.
        $candidates[] = (string) config('services.calendar_reminders.notification_email');

        // Optional fallback: include all admin users from DB.
        if ((bool) config('services.calendar_reminders.notify_admin_users', true)) {
            $adminEmails = User::query()
                ->whereRaw('LOWER(role) = ?', ['admin'])
                ->pluck('email')
                ->all();
            $candidates = array_merge($candidates, $adminEmails);
        }

        // Owner/creator email.
        if ($crm->user_id) {
            $ownerEmail = User::query()
                ->whereKey($crm->user_id)
                ->value('email');
            $candidates[] = (string) $ownerEmail;
        }

        // Current authenticated user email (useful when records don't carry user_id,
        // e.g., Firestore-only updates).
        $authUserEmail = (string) optional(auth()->user())->email;
        $candidates[] = $authUserEmail;

        // Client/contact email.
        if ((bool) config('services.calendar_reminders.notify_client_email', true)) {
            $candidates[] = (string) $crm->email;
        }

        // Optional attendee recipient from previous calendar settings.
        $candidates[] = (string) config('services.calendar_reminders.attendee_email');
        // Fallback recipient to avoid losing alerts when admin/client fields are missing.
        $candidates[] = (string) config('mail.from.address');

        $recipients = [];
        foreach ($candidates as $candidate) {
            $email = strtolower(trim((string) $candidate));
            if ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $recipients[$email] = true;
            }
        }

        return array_keys($recipients);
    }

    protected function parseEmailList(string $value): array
    {
        $items = preg_split('/[,;]+/', $value) ?: [];
        return array_values(array_filter(array_map('trim', $items), fn ($item) => $item !== ''));
    }

    protected function persistEventIds(Crm $crm, array $updates): void
    {
        $dirty = false;
        foreach ($updates as $column => $value) {
            if ($crm->{$column} !== $value) {
                $crm->{$column} = $value;
                $dirty = true;
            }
        }

        if ($dirty) {
            $crm->saveQuietly();
        }
    }

    protected function isGoogleConfigured(): bool
    {
        return (bool) config('services.google_calendar.calendar_id') &&
            (bool) $this->resolveCredentialPath(config('services.google_calendar.credentials'));
    }

    protected function isMicrosoftConfigured(): bool
    {
        return (bool) config('services.microsoft_graph.enabled') &&
            (bool) config('services.microsoft_graph.tenant_id') &&
            (bool) config('services.microsoft_graph.client_id') &&
            (bool) config('services.microsoft_graph.client_secret') &&
            (bool) config('services.microsoft_graph.calendar_user_id');
    }

    protected function getGoogleAccessToken(): ?string
    {
        if ($this->googleAccessToken) {
            return $this->googleAccessToken;
        }

        $credentialPath = $this->resolveCredentialPath(config('services.google_calendar.credentials'));
        if (!$credentialPath) {
            return null;
        }

        try {
            $credentials = new ServiceAccountCredentials(
                ['https://www.googleapis.com/auth/calendar'],
                $credentialPath
            );
            $token = $this->fetchAuthTokenWithoutProxy($credentials)['access_token'] ?? null;
            $this->googleAccessToken = $token;
            return $token;
        } catch (\Throwable $e) {
            Log::error('Failed to fetch Google Calendar access token.', ['error' => $e->getMessage()]);
            return null;
        }
    }

    protected function getMicrosoftAccessToken(): ?string
    {
        if ($this->microsoftAccessToken) {
            return $this->microsoftAccessToken;
        }

        $tenantId = config('services.microsoft_graph.tenant_id');
        $clientId = config('services.microsoft_graph.client_id');
        $clientSecret = config('services.microsoft_graph.client_secret');

        try {
            $response = $this->calendarHttp()->asForm()->post(
                "https://login.microsoftonline.com/{$tenantId}/oauth2/v2.0/token",
                [
                    'grant_type' => 'client_credentials',
                    'client_id' => $clientId,
                    'client_secret' => $clientSecret,
                    'scope' => 'https://graph.microsoft.com/.default',
                ]
            );

            if (!$response->successful()) {
                Log::error('Failed to fetch Microsoft Graph access token.', [
                    'status' => $response->status(),
                    'response' => $response->body(),
                ]);
                return null;
            }

            $this->microsoftAccessToken = $response->json('access_token');
            return $this->microsoftAccessToken;
        } catch (\Throwable $e) {
            Log::error('Microsoft Graph token request failed.', ['error' => $e->getMessage()]);
            return null;
        }
    }

    protected function calendarHttp(): PendingRequest
    {
        return Http::timeout((int) config('services.calendar_reminders.request_timeout_seconds', 8))
            ->connectTimeout((int) config('services.calendar_reminders.connect_timeout_seconds', 4));
    }

    protected function fetchAuthTokenWithoutProxy(ServiceAccountCredentials $credentials): array
    {
        $originalNoProxy = getenv('NO_PROXY');
        $originalNoProxyLower = getenv('no_proxy');

        // Force direct auth token exchange to avoid bad local proxy env values.
        putenv('NO_PROXY=*');
        putenv('no_proxy=*');

        try {
            return $credentials->fetchAuthToken();
        } finally {
            $this->restoreEnvValue('NO_PROXY', $originalNoProxy);
            $this->restoreEnvValue('no_proxy', $originalNoProxyLower);
        }
    }

    protected function restoreEnvValue(string $key, string|false $value): void
    {
        if ($value === false) {
            putenv($key);
            return;
        }

        putenv("{$key}={$value}");
    }

    protected function resolveCredentialPath(?string $path): ?string
    {
        if (!$path) {
            return null;
        }

        $candidate = str_starts_with($path, DIRECTORY_SEPARATOR) || preg_match('/^[A-Za-z]:[\\\\\\/]/', $path)
            ? $path
            : base_path($path);

        if (!is_file($candidate)) {
            Log::warning("Google Calendar credentials file not found: {$candidate}");
            return null;
        }

        return $candidate;
    }
}
