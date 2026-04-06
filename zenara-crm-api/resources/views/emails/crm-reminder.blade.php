<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $subject }}</title>
</head>
<body style="margin:0;padding:0;background:#eef3fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef3fb;padding:28px 14px;">
    <tr>
        <td align="center">
            <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#ffffff;border:1px solid #d8e2f2;border-radius:16px;overflow:hidden;">
                <tr>
                    <td style="padding:24px 26px;background:#0f172a;color:#ffffff;">
                        <div style="font-size:12px;letter-spacing:1.2px;text-transform:uppercase;opacity:0.88;">Zenara CRM Notification</div>
                        <h1 style="margin:10px 0 0;font-size:24px;line-height:1.35;font-weight:700;color:#ffffff;">{{ $subject }}</h1>
                    </td>
                </tr>
                <tr>
                    <td style="padding:24px 26px;">
                        <div style="display:inline-block;padding:7px 12px;background:#ecfeff;border:1px solid #bae6fd;border-radius:999px;color:#075985;font-size:12px;font-weight:700;letter-spacing:0.2px;text-transform:uppercase;">
                            Schedule Update
                        </div>
                        <p style="margin:16px 0 18px;font-size:15px;line-height:1.65;color:#334155;">
                            {{ $summary }}
                        </p>

                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #dbe7f5;border-radius:12px;overflow:hidden;">
                            @foreach ($details as $line)
                                @php
                                    $parts = explode(': ', $line, 2);
                                @endphp
                                <tr>
                                    <td style="padding:11px 13px;background:#f8fbff;border-bottom:1px solid #e7eef8;width:36%;font-size:11px;color:#64748b;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">
                                        {{ $parts[0] ?? '' }}
                                    </td>
                                    <td style="padding:11px 13px;border-bottom:1px solid #e7eef8;font-size:14px;color:#0f172a;line-height:1.45;">
                                        {{ $parts[1] ?? '' }}
                                    </td>
                                </tr>
                            @endforeach
                        </table>

                        <p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#64748b;">
                            This is an automated message from Zenara CRM. Please do not reply directly to this email.
                        </p>
                    </td>
                </tr>
            </table>
        </td>
    </tr>
</table>
</body>
</html>
