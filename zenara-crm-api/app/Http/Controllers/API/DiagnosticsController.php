<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Services\OutboundEmailService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class DiagnosticsController extends Controller
{
    public function __construct(
        protected OutboundEmailService $outboundEmail
    ) {
    }

    public function testEmail(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'to' => 'nullable|email|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $fallback = (string) optional($request->user())->email;
        if ($fallback === '') {
            $fallback = (string) config('mail.from.address');
        }

        $to = (string) $request->input('to', $fallback);
        if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
            return response()->json([
                'message' => 'No valid recipient email found. Pass { "to": "you@example.com" }.',
            ], 422);
        }

        $subject = '[Zenara CRM] SMTP Test Email';
        $sentAt = Carbon::now()->toDateTimeString();
        $body = implode("\n", [
            'This is a test email from Zenara CRM.',
            "Sent at: {$sentAt}",
            'If you received this message, SMTP is working correctly.',
        ]);
        $htmlBody = <<<HTML
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{$subject}</title>
</head>
<body style="margin:0;padding:20px;background:#eef3fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
            <td align="center">
                <table role="presentation" width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;background:#ffffff;border:1px solid #d8e2f2;border-radius:14px;overflow:hidden;">
                    <tr>
                        <td style="padding:20px 22px;background:#0f172a;color:#ffffff;">
                            <div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;opacity:0.88;">Zenara CRM</div>
                            <h1 style="margin:8px 0 0;font-size:22px;line-height:1.3;color:#ffffff;">SMTP Test Email</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:22px;font-size:14px;line-height:1.6;color:#334155;">
                            <p style="margin:0 0 12px;">This is a test email from Zenara CRM.</p>
                            <p style="margin:0 0 12px;"><strong>Sent at:</strong> {$sentAt}</p>
                            <p style="margin:0;">If you received this message, SMTP is working correctly.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
HTML;

        try {
            $this->outboundEmail->send($to, $subject, $body, $htmlBody);

            Log::info('SMTP test email sent.', [
                'to' => $to,
                'mailer' => (string) config('mail.default'),
                'host' => (string) config('mail.mailers.smtp.host'),
                'port' => (string) config('mail.mailers.smtp.port'),
                'delivery_mode' => $this->outboundEmail->deliveryMode(),
                'resend_key_configured' => trim((string) config('services.resend.key')) !== '',
                'resend_from_address' => trim((string) env('RESEND_FROM_ADDRESS', '')),
                'mail_from_address' => (string) config('mail.from.address'),
            ]);

            return response()->json([
                'message' => 'Test email sent.',
                'to' => $to,
                'delivery_mode' => $this->outboundEmail->deliveryMode(),
                'mailer' => (string) config('mail.default'),
                'host' => (string) config('mail.mailers.smtp.host'),
                'port' => (string) config('mail.mailers.smtp.port'),
                'scheme' => (string) config('mail.mailers.smtp.scheme'),
                'app_timezone' => (string) config('app.timezone'),
                'resend_key_configured' => trim((string) config('services.resend.key')) !== '',
                'resend_from_address' => trim((string) env('RESEND_FROM_ADDRESS', '')),
                'mail_from_address' => (string) config('mail.from.address'),
                'calendar_email_notifications_enabled' => (bool) config('services.calendar_reminders.email_notifications_enabled', true),
                'calendar_admin_emails' => (string) config('services.calendar_reminders.admin_emails', ''),
                'sent_at' => $sentAt,
            ]);
        } catch (\Throwable $e) {
            Log::error('SMTP test email failed.', [
                'to' => $to,
                'mailer' => (string) config('mail.default'),
                'host' => (string) config('mail.mailers.smtp.host'),
                'port' => (string) config('mail.mailers.smtp.port'),
                'delivery_mode' => $this->outboundEmail->deliveryMode(),
                'resend_key_configured' => trim((string) config('services.resend.key')) !== '',
                'resend_from_address' => trim((string) env('RESEND_FROM_ADDRESS', '')),
                'mail_from_address' => (string) config('mail.from.address'),
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'Failed to send test email.',
                'error' => $e->getMessage(),
                'to' => $to,
                'delivery_mode' => $this->outboundEmail->deliveryMode(),
                'mailer' => (string) config('mail.default'),
                'host' => (string) config('mail.mailers.smtp.host'),
                'port' => (string) config('mail.mailers.smtp.port'),
                'scheme' => (string) config('mail.mailers.smtp.scheme'),
                'app_timezone' => (string) config('app.timezone'),
                'resend_key_configured' => trim((string) config('services.resend.key')) !== '',
                'resend_from_address' => trim((string) env('RESEND_FROM_ADDRESS', '')),
                'mail_from_address' => (string) config('mail.from.address'),
                'calendar_email_notifications_enabled' => (bool) config('services.calendar_reminders.email_notifications_enabled', true),
                'calendar_admin_emails' => (string) config('services.calendar_reminders.admin_emails', ''),
            ], 500);
        }
    }
}
