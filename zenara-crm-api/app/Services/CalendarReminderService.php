<?php

namespace App\Services;

use App\Models\Crm;
use App\Models\User;
use Google\Auth\Credentials\ServiceAccountCredentials;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class CalendarReminderService
{
    protected ?string $googleAccessToken = null;
    protected ?string $microsoftAccessToken = null;

    public function syncForCrm(Crm $crm): void
    {
        if (!config('services.calendar_reminders.enabled')) {
            return;
        }

        $appointmentChanged = $crm->wasRecentlyCreated
            ? (bool) $crm->appointment
            : $crm->wasChanged('appointment');
        $followUpChanged = $crm->wasRecentlyCreated
            ? (bool) $crm->follow_up
            : $crm->wasChanged('follow_up');

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
        $this->sendScheduleNotificationIfNeeded($crm, 'appointment', $crm->appointment, $appointmentChanged);
        $this->sendScheduleNotificationIfNeeded($crm, 'follow_up', $crm->follow_up, $followUpChanged);
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
            return;
        }

        $label = $type === 'follow_up' ? 'Follow Up' : 'Appointment';
        $company = $crm->company_name ?: 'CRM Contact';

        if ($dateValue) {
            [$start, $end] = $this->buildEventWindow($dateValue);
            $subject = "[Zenara CRM] {$label} Scheduled - {$company}";
            $body = implode("\n", [
                "{$label} has been scheduled/updated.",
                "Company: {$company}",
                "Contact: " . ($crm->contact_person ?: '-'),
                "Start: " . $start->toDayDateTimeString(),
                "End: " . $end->toDayDateTimeString(),
                "Timezone: " . $start->timezoneName,
                "Status: " . ($crm->status ?: '-'),
            ]);
        } else {
            $subject = "[Zenara CRM] {$label} Cancelled - {$company}";
            $body = implode("\n", [
                "{$label} has been removed/cancelled.",
                "Company: {$company}",
                "Contact: " . ($crm->contact_person ?: '-'),
                "Status: " . ($crm->status ?: '-'),
            ]);
        }

        foreach ($recipients as $recipient) {
            try {
                Mail::raw($body, function ($message) use ($recipient, $subject): void {
                    $message->to($recipient)->subject($subject);
                });
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

        // Client/contact email.
        if ((bool) config('services.calendar_reminders.notify_client_email', true)) {
            $candidates[] = (string) $crm->email;
        }

        // Optional attendee recipient from previous calendar settings.
        $candidates[] = (string) config('services.calendar_reminders.attendee_email');

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
