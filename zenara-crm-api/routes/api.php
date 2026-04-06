<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\API\AuthController;
use App\Http\Controllers\API\CrmController;
use App\Http\Controllers\API\FirestoreWebhookController;

/**
 * API routes for CRM listing
 */
Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:10,1');
Route::post('auth/register', [AuthController::class, 'register'])->middleware('throttle:5,1');
Route::post('webhooks/firestore/delete', [FirestoreWebhookController::class, 'handleDelete'])
    ->middleware('throttle:60,1');

Route::middleware('auth.token')->group(function () {
    Route::get('auth/me', [AuthController::class, 'me']);
    Route::post('auth/logout', [AuthController::class, 'logout']);

    Route::post('crms/sync-all', [CrmController::class, 'syncAll'])->middleware('throttle:15,1');
    Route::post('crms/bulk-delete', [CrmController::class, 'bulkDestroy'])->middleware('throttle:30,1');
    Route::apiResource('crms', CrmController::class);
});
