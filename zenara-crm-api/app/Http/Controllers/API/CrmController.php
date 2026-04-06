<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Crm;
use App\Services\CalendarReminderService;
use App\Services\FirestoreService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class CrmController extends Controller
{
    protected FirestoreService $firestore;
    protected CalendarReminderService $calendarReminder;

    public function __construct(FirestoreService $firestore, CalendarReminderService $calendarReminder)
    {
        $this->firestore = $firestore;
        $this->calendarReminder = $calendarReminder;
    }

    protected function allowedCrmFields(): array
    {
        return [
            'company_name',
            'industry',
            'location',
            'contact_person',
            'role',
            'phone',
            'email',
            'source',
            'pain_point',
            'remarks',
            'priority',
            'status',
            'last_contact',
            'next_action',
            'appointment',
            'follow_up',
        ];
    }

    protected function extractCrmPayload(Request $request): array
    {
        return $request->only($this->allowedCrmFields());
    }

    protected function findCrm(int|string $id): ?Crm
    {
        return Crm::find($id);
    }

    protected function ensureAdmin(): ?JsonResponse
    {
        $user = auth()->user();
        $role = strtolower((string) ($user->role ?? ''));
        if ($role === 'admin') {
            return null;
        }

        return response()->json([
            'message' => 'Only admin users can delete contacts.',
        ], 403);
    }

    /**
     * Display a listing of the resource.
     */
    public function index(): JsonResponse
    {
        $crms = Crm::query()
            ->orderByRaw("
                CASE LOWER(priority)
                    WHEN 'high' THEN 3
                    WHEN 'medium' THEN 2
                    WHEN 'low' THEN 1
                    ELSE 0
                END DESC
            ")
            ->orderBy('company_name')
            ->paginate(10);

        return response()->json($crms);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $this->extractCrmPayload($request);

        $validator = Validator::make($data, [
            'company_name' => 'required|string|max:255',
            'email' => 'nullable|email|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $authId = auth()->id();
        if (is_numeric($authId)) {
            // Keep creator metadata while sharing the same dataset across users.
            $data['user_id'] = (int) $authId;
        }
        $crm = Crm::create($data);

        $this->syncExternalSystems($crm);

        return response()->json($crm, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show($id): JsonResponse
    {
        $crm = $this->findCrm($id);
        if (!$crm) {
            return response()->json(['message' => 'Contact not found'], 404);
        }

        return response()->json($crm);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, $id): JsonResponse
    {
        $crm = $this->findCrm($id);
        if (!$crm) {
            return response()->json(['message' => 'Contact not found'], 404);
        }

        $data = $this->extractCrmPayload($request);

        $validator = Validator::make($data, [
            'company_name' => 'sometimes|required|string|max:255',
            'email' => 'nullable|email|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $crm->update($data);
        $this->syncExternalSystems($crm);

        return response()->json($crm);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy($id): JsonResponse
    {
        $adminCheck = $this->ensureAdmin();
        if ($adminCheck) {
            return $adminCheck;
        }

        $crm = $this->findCrm($id);
        if (!$crm) {
            return response()->json(['message' => 'Contact not found'], 404);
        }

        Log::info("CRM Delete Request for ID: {$id}");

        try {
            $this->safeRemoveCalendarReminders($crm);
            $crm->delete();
            $this->safeDeleteFromFirestore($id);
            Log::info("CRM Deleted successfully from DB and Firestore: ID {$id}");
            return response()->json(null, 204);
        } catch (\Throwable $e) {
            Log::error("CRM Delete Exception for ID {$id}: " . $e->getMessage());
            return response()->json(['message' => 'Internal Server Error'], 500);
        }
    }

    /**
     * Remove multiple resources from storage.
     */
    public function bulkDestroy(Request $request): JsonResponse
    {
        $adminCheck = $this->ensureAdmin();
        if ($adminCheck) {
            return $adminCheck;
        }

        $ids = collect($request->input('ids', []))
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->unique()
            ->values()
            ->all();

        if (empty($ids)) {
            return response()->json(['message' => 'No valid IDs provided'], 400);
        }

        Log::info('Bulk Delete Request for IDs: ' . implode(', ', $ids));

        $targetCrms = Crm::whereIn('id', $ids)->get();

        $deletedCount = 0;
        foreach ($targetCrms as $crm) {
            $this->safeRemoveCalendarReminders($crm);
            $crm->delete();
            $this->safeDeleteFromFirestore($crm->id);
            $deletedCount++;
        }

        return response()->json(['message' => "Successfully deleted {$deletedCount} contacts"], 200);
    }

    /**
     * Synchronize all local records to Firestore.
     */
    public function syncAll(): JsonResponse
    {
        $crms = Crm::all();
        $syncedCount = 0;

        foreach ($crms as $crm) {
            $this->safeSyncToFirestore($crm);
            $syncedCount++;
        }

        return response()->json([
            'message' => "Successfully synchronized {$syncedCount} contacts to Firestore",
            'total' => $crms->count(),
        ], 200);
    }

    protected function syncExternalSystems(Crm $crm): void
    {
        $this->safeSyncCalendarReminders($crm);
        $this->safeSyncToFirestore($crm);
    }

    protected function safeSyncCalendarReminders(Crm $crm): void
    {
        try {
            $this->calendarReminder->syncForCrm($crm);
        } catch (\Throwable $e) {
            Log::warning('Calendar reminder sync failed but CRM data was saved.', [
                'crm_id' => $crm->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    protected function safeRemoveCalendarReminders(Crm $crm): void
    {
        try {
            $this->calendarReminder->removeForCrm($crm);
        } catch (\Throwable $e) {
            Log::warning('Calendar reminder cleanup failed during delete.', [
                'crm_id' => $crm->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    protected function safeSyncToFirestore(Crm $crm): void
    {
        try {
            $this->firestore->sync($crm->id, $crm->toArray());
        } catch (\Throwable $e) {
            Log::warning('Firestore sync failed but CRM data was saved.', [
                'crm_id' => $crm->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    protected function safeDeleteFromFirestore(int|string $crmId): void
    {
        try {
            $this->firestore->delete($crmId);
        } catch (\Throwable $e) {
            Log::warning('Firestore delete sync failed.', [
                'crm_id' => $crmId,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
