<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

class AuthenticateApiToken
{
    public function handle(Request $request, Closure $next)
    {
        if (!Schema::hasColumn('users', 'api_token') || !Schema::hasColumn('users', 'api_token_expires_at')) {
            Log::error('Auth middleware failed: users token columns are missing.');
            return response()->json([
                'message' => 'Database schema is not up to date. Please run: php artisan migrate',
            ], 500);
        }

        $token = $request->bearerToken();
        if (!$token) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $hashedToken = hash('sha256', $token);
        $user = User::where('api_token', $hashedToken)->first();

        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if (!$user->api_token_expires_at || Carbon::parse($user->api_token_expires_at)->isPast()) {
            $user->forceFill([
                'api_token' => null,
                'api_token_expires_at' => null,
            ])->save();
            return response()->json(['message' => 'Session expired. Please login again.'], 401);
        }

        auth()->setUser($user);
        $request->setUserResolver(fn () => $user);

        return $next($request);
    }
}
