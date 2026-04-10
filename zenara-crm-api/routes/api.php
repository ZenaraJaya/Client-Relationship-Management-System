<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\API\AuthController;
use App\Http\Controllers\API\CrmController;
use App\Http\Controllers\API\DiagnosticsController;
use App\Http\Controllers\API\FirestoreWebhookController;

/**
 * API routes for CRM listing
 */
Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:10,1');
Route::post('auth/register', [AuthController::class, 'register'])->middleware('throttle:5,1');
Route::get('auth/profile-photo/{user}', [AuthController::class, 'profilePhoto'])
    ->name('auth.profile-photo')
    ->middleware('throttle:60,1');
Route::get('auth/microsoft/auth-url', [AuthController::class, 'microsoftAuthUrl'])
    ->middleware('throttle:30,1');
Route::get('auth/microsoft/callback', [AuthController::class, 'handleMicrosoftCallback'])
    ->middleware('throttle:30,1');
Route::post('webhooks/firestore/delete', [FirestoreWebhookController::class, 'handleDelete'])
    ->middleware('throttle:60,1');

Route::middleware('auth.token')->group(function () {
    Route::get('auth/me', [AuthController::class, 'me']);
    Route::get('auth/users', [AuthController::class, 'users']);
    Route::put('auth/profile', [AuthController::class, 'updateProfile']);
    Route::post('auth/logout', [AuthController::class, 'logout']);
    Route::get('auth/microsoft/connect-url', [AuthController::class, 'microsoftConnectUrl']);
    Route::delete('auth/microsoft/connection', [AuthController::class, 'disconnectMicrosoftCalendar']);
    Route::post('test-email', [DiagnosticsController::class, 'testEmail'])->middleware('throttle:10,1');

    Route::post('crms/sync-all', [CrmController::class, 'syncAll'])->middleware('throttle:15,1');
    Route::post('crms/bulk-delete', [CrmController::class, 'bulkDestroy'])->middleware('throttle:30,1');
    Route::apiResource('crms', CrmController::class);
});
