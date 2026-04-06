<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Crm;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class FirestoreWebhookController extends Controller
{
    protected function isAuthorized(Request $request): bool
    {
        $expectedSecret = (string) env('FIRESTORE_SYNC_SECRET', '');
        if ($expectedSecret === '') {
            Log::warning('Firestore webhook rejected: FIRESTORE_SYNC_SECRET is not configured.');
            return false;
        }

        $providedSecret = (string) $request->header('X-Firestore-Sync-Secret', '');
        return hash_equals($expectedSecret, $providedSecret);
    }

    public function handleDelete(Request $request): JsonResponse
    {
        if (!$this->isAuthorized($request)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validator = Validator::make($request->all(), [
            'collection' => 'required|string|in:crms,users',
            'document_id' => 'required',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $collection = (string) $request->input('collection');
        $documentId = (string) $request->input('document_id');

        if ($collection === 'crms') {
            $deleted = Crm::query()->where('id', $documentId)->delete();
            return response()->json([
                'message' => 'CRM delete sync processed.',
                'deleted' => (int) $deleted,
            ]);
        }

        $deleted = User::query()->where('id', $documentId)->delete();
        return response()->json([
            'message' => 'User delete sync processed.',
            'deleted' => (int) $deleted,
        ]);
    }
}

