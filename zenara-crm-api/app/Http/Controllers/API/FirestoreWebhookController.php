<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Crm;
use App\Models\User;
use App\Services\CalendarReminderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class FirestoreWebhookController extends Controller
{
    public function __construct(
        protected CalendarReminderService $calendarReminder
    ) {
    }

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
            $crm = Crm::query()->find($documentId);
            if (!$crm) {
                return response()->json([
                    'message' => 'CRM delete sync processed.',
                    'deleted' => 0,
                ]);
            }

            try {
                $this->calendarReminder->removeForCrm($crm);
            } catch (\Throwable $e) {
                Log::warning('Calendar reminder cleanup failed during Firestore delete sync.', [
                    'crm_id' => $documentId,
                    'error' => $e->getMessage(),
                ]);
            }

            $deleted = (int) $crm->delete();
            return response()->json([
                'message' => 'CRM delete sync processed.',
                'deleted' => $deleted,
            ]);
        }

        $deleted = User::query()->where('id', $documentId)->delete();
        return response()->json([
            'message' => 'User delete sync processed.',
            'deleted' => (int) $deleted,
        ]);
    }
}
