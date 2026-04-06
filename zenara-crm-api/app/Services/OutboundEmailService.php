<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use RuntimeException;

class OutboundEmailService
{
    public function deliveryMode(): string
    {
        $mode = strtolower(trim((string) env('EMAIL_DELIVERY_MODE', 'auto')));

        return match ($mode) {
            'mail' => 'mail',
            'resend_api' => 'resend_api',
            default => $this->isResendConfigured() ? 'resend_api' : 'mail',
        };
    }

    public function sendText(string $to, string $subject, string $body): void
    {
        $mode = $this->deliveryMode();

        if ($mode === 'resend_api') {
            $this->sendTextViaResend($to, $subject, $body);
            return;
        }

        Mail::raw($body, function ($message) use ($to, $subject): void {
            $message->to($to)->subject($subject);
        });
    }

    protected function sendTextViaResend(string $to, string $subject, string $body): void
    {
        $apiKey = (string) config('services.resend.key');
        if ($apiKey === '') {
            throw new RuntimeException('RESEND_API_KEY is not configured.');
        }

        $fromAddress = trim((string) env('RESEND_FROM_ADDRESS', (string) config('mail.from.address')));
        $fromName = trim((string) env('RESEND_FROM_NAME', (string) config('mail.from.name')));

        if ($fromAddress === '' || !filter_var($fromAddress, FILTER_VALIDATE_EMAIL)) {
            throw new RuntimeException('RESEND_FROM_ADDRESS is missing or invalid.');
        }

        $from = $fromName !== ''
            ? sprintf('%s <%s>', $fromName, $fromAddress)
            : $fromAddress;

        $response = Http::timeout(20)
            ->connectTimeout(8)
            ->withToken($apiKey)
            ->acceptJson()
            ->post('https://api.resend.com/emails', [
                'from' => $from,
                'to' => [$to],
                'subject' => $subject,
                'text' => $body,
            ]);

        if (!$response->successful()) {
            throw new RuntimeException(sprintf(
                'Resend API failed (%s): %s',
                $response->status(),
                trim((string) $response->body())
            ));
        }
    }

    protected function isResendConfigured(): bool
    {
        return trim((string) config('services.resend.key')) !== '';
    }
}
