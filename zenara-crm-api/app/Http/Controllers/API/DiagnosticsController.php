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

        try {
            $this->outboundEmail->sendText($to, $subject, $body);

            Log::info('SMTP test email sent.', [
                'to' => $to,
                'mailer' => (string) config('mail.default'),
                'host' => (string) config('mail.mailers.smtp.host'),
                'port' => (string) config('mail.mailers.smtp.port'),
                'delivery_mode' => $this->outboundEmail->deliveryMode(),
            ]);

            return response()->json([
                'message' => 'Test email sent.',
                'to' => $to,
                'delivery_mode' => $this->outboundEmail->deliveryMode(),
                'mailer' => (string) config('mail.default'),
                'host' => (string) config('mail.mailers.smtp.host'),
                'port' => (string) config('mail.mailers.smtp.port'),
                'scheme' => (string) config('mail.mailers.smtp.scheme'),
                'sent_at' => $sentAt,
            ]);
        } catch (\Throwable $e) {
            Log::error('SMTP test email failed.', [
                'to' => $to,
                'mailer' => (string) config('mail.default'),
                'host' => (string) config('mail.mailers.smtp.host'),
                'port' => (string) config('mail.mailers.smtp.port'),
                'delivery_mode' => $this->outboundEmail->deliveryMode(),
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
            ], 500);
        }
    }
}
