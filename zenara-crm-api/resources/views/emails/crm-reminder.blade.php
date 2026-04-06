<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $subject }}</title>
</head>
<body style="margin:0;padding:0;background:#f3f6fb;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6fb;padding:24px 0;">
    <tr>
        <td align="center">
            <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#ffffff;border:1px solid #dbe4f0;border-radius:14px;overflow:hidden;">
                <tr>
                    <td style="padding:22px 24px;background:linear-gradient(135deg,#0f172a,#1e293b);color:#ffffff;">
                        <div style="font-size:12px;letter-spacing:1.2px;text-transform:uppercase;opacity:0.9;">Zenara CRM</div>
                        <h1 style="margin:10px 0 0;font-size:22px;line-height:1.3;font-weight:700;">{{ $subject }}</h1>
                    </td>
                </tr>
                <tr>
                    <td style="padding:24px;">
                        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">
                            {{ $summary }}
                        </p>

                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #dbe4f0;border-radius:10px;overflow:hidden;">
                            @foreach ($details as $line)
                                @php
                                    $parts = explode(': ', $line, 2);
                                @endphp
                                <tr>
                                    <td style="padding:10px 12px;background:#f8fbff;border-bottom:1px solid #e2e8f0;width:35%;font-size:13px;color:#475569;font-weight:600;">
                                        {{ $parts[0] ?? '' }}
                                    </td>
                                    <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a;">
                                        {{ $parts[1] ?? '' }}
                                    </td>
                                </tr>
                            @endforeach
                        </table>

                        <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#64748b;">
                            This message was generated automatically by Zenara CRM.
                        </p>
                    </td>
                </tr>
            </table>
        </td>
    </tr>
</table>
</body>
</html>
