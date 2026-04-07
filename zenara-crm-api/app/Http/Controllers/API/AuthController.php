<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Services\FirestoreService;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    public function __construct(
        protected FirestoreService $firestore
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
        $payload = [
            'id' => (string) $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
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
            'user' => $user,
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
            'user' => $user,
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        if (!$this->tokenColumnReady()) {
            return $this->schemaOutOfDateResponse();
        }

        return response()->json($request->user());
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
}
