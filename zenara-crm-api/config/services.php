<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'calendar_reminders' => [
        'enabled' => env('CALENDAR_REMINDERS_ENABLED', false),
        'default_hour' => (int) env('CALENDAR_REMINDER_HOUR', 9),
        'pre_reminder_minutes' => (int) env('CALENDAR_PRE_REMINDER_MINUTES', 15),
        'due_reminder_grace_minutes' => (int) env('CALENDAR_DUE_REMINDER_GRACE_MINUTES', 5),
        'default_duration_minutes' => (int) env('CALENDAR_REMINDER_DURATION_MINUTES', 30),
        'request_timeout_seconds' => (int) env('CALENDAR_REMINDER_REQUEST_TIMEOUT', 8),
        'connect_timeout_seconds' => (int) env('CALENDAR_REMINDER_CONNECT_TIMEOUT', 4),
        'attendee_email' => env('CALENDAR_REMINDER_ATTENDEE_EMAIL'),
        'email_notifications_enabled' => env('CALENDAR_EMAIL_NOTIFICATIONS_ENABLED', true),
        'notification_email' => env('CALENDAR_REMINDER_NOTIFICATION_EMAIL'),
        'admin_emails' => env('CALENDAR_REMINDER_ADMIN_EMAILS', ''),
        'notify_client_email' => env('CALENDAR_NOTIFY_CLIENT_EMAIL', true),
        'notify_admin_users' => env('CALENDAR_NOTIFY_ADMIN_USERS', true),
        'notify_owner_email' => env('CALENDAR_NOTIFY_OWNER_EMAIL', false),
        'notify_auth_user_email' => env('CALENDAR_NOTIFY_AUTH_USER_EMAIL', false),
        'notify_auth_admin_only' => env('CALENDAR_NOTIFY_AUTH_ADMIN_ONLY', false),
        'notify_attendee_email' => env('CALENDAR_NOTIFY_ATTENDEE_EMAIL', false),
        'notify_from_address' => env('CALENDAR_NOTIFY_FROM_ADDRESS', false),
    ],

    'google_calendar' => [
        'credentials' => env('GOOGLE_CALENDAR_CREDENTIALS', env('FIREBASE_CREDENTIALS')),
        'calendar_id' => env('GOOGLE_CALENDAR_ID'),
    ],

    'microsoft_graph' => [
        'enabled' => env('MICROSOFT_CALENDAR_ENABLED', false),
        'tenant_id' => env('MICROSOFT_TENANT_ID'),
        'client_id' => env('MICROSOFT_CLIENT_ID'),
        'client_secret' => env('MICROSOFT_CLIENT_SECRET'),
        'calendar_user_id' => env('MICROSOFT_CALENDAR_USER_ID'),
    ],

    'firebase' => [
        'credentials' => env('FIREBASE_CREDENTIALS'),
        'project_id' => env('FIREBASE_PROJECT_ID'),
    ],

];
