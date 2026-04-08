<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\CrmCalendarEvent;
use App\Models\User;
use App\Services\FirestoreService;
use App\Services\MicrosoftCalendarOAuthService;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    public function __construct(
        protected FirestoreService $firestore,
        protected MicrosoftCalendarOAuthService $microsoftOauth
    ) {
    }

    protected function tokenColumnReady(): bool
    {
        return Schema::hasColumn('users', 'api_token')
            && Schema::hasColumn('users', 'api_token_expires_at');
    }

    protected function schemaOutOfDateResponse(): JsonResponse
    {
        return response()->json([
            'message' => 'Database schema is not up to date. Please run: php artisan migrate',
        ], 500);
    }

    protected function tokenTtlMinutes(): int
    {
        return max(15, (int) env('AUTH_TOKEN_TTL_MINUTES', 720));
    }

    protected function issueToken(User $user): string
    {
        $plainToken = Str::random(60);
        $user->forceFill([
            'api_token' => hash('sha256', $plainToken),
            'api_token_expires_at' => Carbon::now()->addMinutes($this->tokenTtlMinutes()),
        ])->save();

        return $plainToken;
    }

    protected function syncUserToFirestore(User $user): void
    {
        $connection = $user->relationLoaded('microsoftCalendarConnection')
            ? $user->microsoftCalendarConnection
            : $user->microsoftCalendarConnection()->first();

        $payload = [
            'id' => (string) $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'profile_photo_url' => $this->profilePhotoUrlForUser($user),
            'microsoft_calendar_connected' => (bool) $connection,
            'microsoft_calendar_email' => $connection?->microsoft_email,
            'has_active_session' => (bool) $user->api_token,
            'token_expires_at' => $user->api_token_expires_at?->toDateTimeString(),
            // Wipe legacy sensitive fields from previous sync versions
            'password' => null,
            'api_token' => null,
            'created_at' => $user->created_at?->toDateTimeString(),
            'updated_at' => $user->updated_at?->toDateTimeString(),
        ];

        try {
            $this->firestore->sync($user->id, $payload, 'users');
        } catch (\Throwable $e) {
            Log::warning('User Firestore sync failed.', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    protected function resolveApiRoot(?Request $request = null): string
    {
        if ($request) {
            return rtrim($request->getSchemeAndHttpHost(), '/');
        }

        return rtrim((string) config('app.url', ''), '/');
    }

    protected function profilePhotoUrlForUser(User $user, ?Request $request = null): ?string
    {
        if (!$user->profile_photo_path) {
            return null;
        }

        $relativePath = route('auth.profile-photo', ['user' => $user->id], false);
        $version = $user->updated_at?->timestamp;
        if ($version) {
            $relativePath .= '?v=' . $version;
        }

        $apiRoot = $this->resolveApiRoot($request);
        if ($apiRoot === '') {
            return $relativePath;
        }

        return $apiRoot . $relativePath;
    }

    protected function serializeAuthUser(User $user, ?Request $request = null): array
    {
        $user->loadMissing('microsoftCalendarConnection');

        return array_merge($user->withoutRelations()->toArray(), [
            'profile_photo_url' => $this->profilePhotoUrlForUser($user, $request),
            'microsoft_calendar_connected' => (bool) $user->microsoftCalendarConnection,
            'microsoft_calendar_email' => $user->microsoftCalendarConnection?->microsoft_email,
            'microsoft_calendar_display_name' => $user->microsoftCalendarConnection?->microsoft_display_name,
        ]);
    }

    protected function pruneStaleFirestoreDeletedUser(?string $email): void
    {
        $normalizedEmail = strtolower(trim((string) $email));
        if ($normalizedEmail === '' || !$this->firestore->isConfigured()) {
            return;
        }

        $user = User::query()
            ->whereRaw('LOWER(email) = ?', [$normalizedEmail])
            ->first();

        if (!$user) {
            return;
        }

        $existsInFirestore = $this->firestore->exists($user->id, 'users');
        if ($existsInFirestore !== false) {
            return;
        }

        DB::transaction(function () use ($user): void {
            DB::table('password_reset_tokens')
                ->where('email', $user->email)
                ->delete();

            DB::table('sessions')
                ->where('user_id', $user->id)
                ->delete();

            $user->delete();
        });

        Log::info('Removed stale local user missing from Firestore during registration.', [
            'user_id' => $user->id,
            'email' => $normalizedEmail,
        ]);
    }

    protected function resolveFrontendOrigin(Request $request): ?string
    {
        $candidate = trim((string) ($request->query('origin') ?: $request->headers->get('Origin', '')));
        if ($candidate === '' || !filter_var($candidate, FILTER_VALIDATE_URL)) {
            return null;
        }

        $parts = parse_url($candidate);
        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = (string) ($parts['host'] ?? '');
        $port = isset($parts['port']) ? ':' . $parts['port'] : '';

        if (!in_array($scheme, ['http', 'https'], true) || $host === '') {
            return null;
        }

        return "{$scheme}://{$host}{$port}";
    }

    protected function renderMicrosoftOauthCallback(?string $origin, bool $ok, string $message, array $extra = [])
    {
        $payload = json_encode(
            array_merge(
                [
                    'type' => 'zenara:outlook-calendar-auth',
                    'ok' => $ok,
                    'message' => $message,
                ],
                $extra
            ),
            JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT
        );
        $targetOrigin = $origin && filter_var($origin, FILTER_VALIDATE_URL) ? $origin : '*';
        $safeTitle = htmlspecialchars($ok ? 'Outlook Connected' : 'Outlook Connection Failed', ENT_QUOTES, 'UTF-8');
        $safeMessage = htmlspecialchars($message, ENT_QUOTES, 'UTF-8');
        $targetOriginJson = json_encode($targetOrigin, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT);

        return response(<<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{$safeTitle}</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f8fafc; color: #0f172a; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; box-shadow: 0 14px 30px rgba(15, 23, 42, 0.08); max-width: 420px; padding: 24px; text-align: center; }
    .status { font-size: 18px; font-weight: 700; margin-bottom: 12px; }
    .copy { color: #475569; line-height: 1.5; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="status">{$safeTitle}</div>
    <p class="copy">{$safeMessage}</p>
  </div>
  <script>
    (function () {
      var payload = {$payload};
      if (window.opener && typeof window.opener.postMessage === 'function') {
        window.opener.postMessage(payload, {$targetOriginJson});
        window.close();
      }
    })();
  </script>
</body>
</html>
HTML, 200)->header('Content-Type', 'text/html; charset=UTF-8');
    }

    public function register(Request $request): JsonResponse
    {
        if (!$this->tokenColumnReady()) {
            Log::error('Auth failed: users token columns are missing.');
            return $this->schemaOutOfDateResponse();
        }

        $this->pruneStaleFirestoreDeletedUser($request->input('email'));

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255|unique:users,email',
            'password' => 'required|string|min:6',
            'role' => 'nullable|string|in:admin,staff',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            $requestedRole = strtolower((string) $request->input('role', 'staff'));
            if (!in_array($requestedRole, ['admin', 'staff'], true)) {
                $requestedRole = 'staff';
            }

            $user = User::create([
                'name' => $request->input('name'),
                'email' => $request->input('email'),
                'role' => $requestedRole,
                'password' => $request->input('password'),
            ]);

            $plainToken = $this->issueToken($user);
            $this->syncUserToFirestore($user);
        } catch (QueryException $e) {
            Log::error('Register query failed.', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Unable to register right now. Please try again.'], 500);
        }

        return response()->json([
            'message' => 'Account created successfully.',
            'token' => $plainToken,
            'token_expires_at' => $user->api_token_expires_at?->toDateTimeString(),
            'user' => $this->serializeAuthUser($user, $request),
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        if (!$this->tokenColumnReady()) {
            Log::error('Auth failed: users token columns are missing.');
            return $this->schemaOutOfDateResponse();
        }

        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            $user = User::where('email', $request->input('email'))->first();
            if (!$user || !Hash::check($request->input('password'), $user->password)) {
                return response()->json(['message' => 'Invalid email or password.'], 401);
            }

            $plainToken = $this->issueToken($user);
            $this->syncUserToFirestore($user);
        } catch (QueryException $e) {
            Log::error('Login query failed.', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Unable to login right now. Please try again.'], 500);
        }

        return response()->json([
            'message' => 'Login successful.',
            'token' => $plainToken,
            'token_expires_at' => $user->api_token_expires_at?->toDateTimeString(),
            'user' => $this->serializeAuthUser($user, $request),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        if (!$this->tokenColumnReady()) {
            return $this->schemaOutOfDateResponse();
        }

        return response()->json($this->serializeAuthUser($request->user(), $request));
    }

    public function updateProfile(Request $request): JsonResponse
    {
        if (!$this->tokenColumnReady()) {
            return $this->schemaOutOfDateResponse();
        }

        /** @var User $user */
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'profile_photo' => 'nullable|image|max:3072',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            $user->name = trim((string) $request->input('name'));

            if ($request->hasFile('profile_photo')) {
                if ($user->profile_photo_path) {
                    Storage::disk('public')->delete($user->profile_photo_path);
                }

                $user->profile_photo_path = $request->file('profile_photo')->store('profile-photos', 'public');
            }

            $user->save();

            $freshUser = $user->fresh() ?? $user;
            $this->syncUserToFirestore($freshUser);
        } catch (QueryException $e) {
            Log::error('Profile update query failed.', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Unable to update your profile right now. Please try again.'], 500);
        }

        return response()->json([
            'message' => 'Profile updated successfully.',
            'user' => $this->serializeAuthUser($freshUser, $request),
        ]);
    }

    public function profilePhoto(User $user)
    {
        if (!$user->profile_photo_path || !Storage::disk('public')->exists($user->profile_photo_path)) {
            abort(404);
        }

        return Storage::disk('public')->response(
            $user->profile_photo_path,
            null,
            ['Cache-Control' => 'public, max-age=3600']
        );
    }

    public function logout(Request $request): JsonResponse
    {
        if (!$this->tokenColumnReady()) {
            return $this->schemaOutOfDateResponse();
        }

        $user = $request->user();
        if ($user) {
            try {
                $user->forceFill([
                    'api_token' => null,
                    'api_token_expires_at' => null,
                ])->save();
                $this->syncUserToFirestore($user);
            } catch (QueryException $e) {
                Log::error('Logout query failed.', ['error' => $e->getMessage()]);
                return response()->json(['message' => 'Unable to logout right now. Please try again.'], 500);
            }
        }

        return response()->json(['message' => 'Logged out successfully.']);
    }

    public function microsoftConnectUrl(Request $request): JsonResponse
    {
        $origin = $this->resolveFrontendOrigin($request);
        if (!$origin) {
            return response()->json(['message' => 'A valid frontend origin is required.'], 422);
        }

        if (!$this->microsoftOauth->delegatedAuthConfigured()) {
            return response()->json(['message' => 'Microsoft Outlook OAuth is not configured on the server.'], 500);
        }

        try {
            $url = $this->microsoftOauth->buildAuthorizationUrl($request->user(), $origin);
        } catch (\Throwable $e) {
            Log::error('Failed to build Microsoft OAuth URL.', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Unable to start Outlook connection right now.'], 500);
        }

        return response()->json(['url' => $url]);
    }

    public function handleMicrosoftCallback(Request $request)
    {
        $state = (string) $request->query('state', '');
        $error = trim((string) $request->query('error', ''));
        $errorDescription = trim((string) $request->query('error_description', ''));
        $origin = $this->microsoftOauth->resolveOriginFromState($state);

        if ($error !== '') {
            return $this->renderMicrosoftOauthCallback(
                $origin,
                false,
                $errorDescription !== '' ? $errorDescription : 'Microsoft sign-in was cancelled or denied.'
            );
        }

        $code = trim((string) $request->query('code', ''));
        if ($state === '' || $code === '') {
            return $this->renderMicrosoftOauthCallback(
                $origin,
                false,
                'Microsoft did not return the required authorization code.'
            );
        }

        try {
            $result = $this->microsoftOauth->completeAuthorization($state, $code);
            /** @var User $user */
            $user = $result['user'];
            $user->load('microsoftCalendarConnection');
            $this->syncUserToFirestore($user);

            return $this->renderMicrosoftOauthCallback(
                (string) ($result['origin'] ?? ''),
                true,
                'Outlook calendar connected successfully.',
                [
                    'email' => $user->microsoftCalendarConnection?->microsoft_email,
                ]
            );
        } catch (\Throwable $e) {
            Log::error('Microsoft OAuth callback failed.', [
                'error' => $e->getMessage(),
                'exception' => $e::class,
                'origin' => $origin,
                'state_present' => $state !== '',
            ]);

            $safeMessage = trim($e->getMessage()) !== ''
                ? $e->getMessage()
                : 'Unable to connect Outlook right now. Please try again.';

            return $this->renderMicrosoftOauthCallback($origin, false, $safeMessage);
        }
    }

    public function disconnectMicrosoftCalendar(Request $request): JsonResponse
    {
        $user = $request->user();

        try {
            DB::transaction(function () use ($user): void {
                CrmCalendarEvent::query()
                    ->where('user_id', $user->id)
                    ->where('provider', 'microsoft-user')
                    ->delete();

                $this->microsoftOauth->disconnect($user);
            });

            $freshUser = $user->fresh() ?? $user;
            $this->syncUserToFirestore($freshUser);
        } catch (\Throwable $e) {
            Log::error('Outlook disconnect failed.', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Unable to disconnect Outlook right now.'], 500);
        }

        return response()->json([
            'message' => 'Outlook calendar disconnected.',
            'user' => $this->serializeAuthUser($freshUser, $request),
        ]);
    }
}
