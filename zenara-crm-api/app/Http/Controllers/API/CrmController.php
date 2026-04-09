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

    protected function searchableCrmFields(): array
    {
        return array_values(array_unique(array_merge(
            $this->allowedCrmFields(),
            ['created_at', 'updated_at']
        )));
    }

    protected function crmMatchesSearch(array $payload, string $search): bool
    {
        $needle = strtolower(trim($search));
        if ($needle === '') {
            return true;
        }

        $candidates = [(string) ($payload['id'] ?? '')];
        foreach ($this->searchableCrmFields() as $field) {
            $value = $payload[$field] ?? '';
            if (is_scalar($value) || $value === null) {
                $candidates[] = (string) ($value ?? '');
            } else {
                $candidates[] = (string) json_encode($value);
            }
        }

        foreach ($candidates as $candidate) {
            if ($candidate !== '' && str_contains(strtolower($candidate), $needle)) {
                return true;
            }
        }

        return false;
    }

    protected function extractCrmPayload(Request $request): array
    {
        return $request->only($this->allowedCrmFields());
    }

    protected function crmNotificationPayload(array $source, int|string|null $id = null): array
    {
        $payload = [
            'id' => $id,
            'user_id' => $source['user_id'] ?? null,
        ];
        foreach ($this->allowedCrmFields() as $field) {
            $payload[$field] = $source[$field] ?? null;
        }

        return $payload;
    }

    protected function findCrm(int|string $id): ?Crm
    {
        return Crm::find($id);
    }

    protected function ensureAdmin(string $message = 'Only admin users can perform this action.'): ?JsonResponse
    {
        $user = auth()->user();
        if ($user?->isAdmin()) {
            return null;
        }

        return response()->json([
            'message' => $message,
        ], 403);
    }

    protected function priorityScore(?string $priority): int
    {
        return match (strtolower((string) $priority)) {
            'high' => 3,
            'medium' => 2,
            'low' => 1,
            default => 0,
        };
    }

    protected function paginateFirestoreCrms(array $items, int $page = 1, int $perPage = 10): array
    {
        $normalized = array_map(function ($item) {
            if (!is_array($item)) {
                return [];
            }

            $payload = [
                'id' => $item['id'] ?? null,
            ];

            foreach ($this->allowedCrmFields() as $field) {
                $payload[$field] = $item[$field] ?? null;
            }

            $payload['created_at'] = $item['created_at'] ?? null;
            $payload['updated_at'] = $item['updated_at'] ?? null;

            return $payload;
        }, $items);

        usort($normalized, function (array $a, array $b): int {
            $priorityCompare = $this->priorityScore($b['priority'] ?? null) <=> $this->priorityScore($a['priority'] ?? null);
            if ($priorityCompare !== 0) {
                return $priorityCompare;
            }

            return strcmp((string) ($a['company_name'] ?? ''), (string) ($b['company_name'] ?? ''));
        });

        $total = count($normalized);
        $lastPage = max(1, (int) ceil($total / $perPage));
        $currentPage = min(max(1, $page), $lastPage);
        $offset = ($currentPage - 1) * $perPage;
        $pageItems = array_slice($normalized, $offset, $perPage);

        return [
            'current_page' => $currentPage,
            'data' => array_values($pageItems),
            'first_page_url' => null,
            'from' => $total > 0 ? $offset + 1 : null,
            'last_page' => $lastPage,
            'last_page_url' => null,
            'links' => [],
            'next_page_url' => null,
            'path' => null,
            'per_page' => $perPage,
            'prev_page_url' => null,
            'to' => $total > 0 ? min($offset + $perPage, $total) : null,
            'total' => $total,
        ];
    }

    /**
     * Display a listing of the resource.
     */
    public function index(): JsonResponse
    {
        $search = trim((string) request()->query('search', ''));

        if ($this->firestore->isConfigured()) {
            $firestoreCrms = $this->firestore->list();
            if (is_array($firestoreCrms)) {
                if ($search !== '') {
                    $firestoreCrms = array_values(array_filter(
                        $firestoreCrms,
                        fn ($item) => is_array($item) && $this->crmMatchesSearch($item, $search)
                    ));
                }

                $page = max(1, (int) request()->query('page', 1));
                return response()->json($this->paginateFirestoreCrms($firestoreCrms, $page, 10));
            }
        }

        $crmsQuery = Crm::query();
        if ($search !== '') {
            $searchLike = '%' . $search . '%';
            $searchFields = $this->searchableCrmFields();

            $crmsQuery->where(function ($query) use ($searchLike, $searchFields, $search): void {
                foreach ($searchFields as $field) {
                    $query->orWhere($field, 'like', $searchLike);
                }

                if (is_numeric($search)) {
                    $query->orWhere('id', (int) $search);
                }
            });
        }

        $crms = $crmsQuery
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

        $calendarWarnings = $this->syncExternalSystems($crm, false);
        $this->safeNotifyScheduleChangesFromPayload([], $this->crmNotificationPayload($crm->toArray(), $crm->id));

        return response()->json($this->buildCrmResponsePayload($crm, $calendarWarnings), 201);
    }

    /**
     * Display the specified resource.
     */
    public function show($id): JsonResponse
    {
        if ($this->firestore->isConfigured()) {
            $remote = $this->firestore->find($id);
            if ($remote !== null) {
                return response()->json($remote);
            }
        }

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
        $adminCheck = $this->ensureAdmin('Only admin users can edit contacts.');
        if ($adminCheck) {
            return $adminCheck;
        }

        $crm = $this->findCrm($id);
        $data = $this->extractCrmPayload($request);

        $validator = Validator::make($data, [
            'company_name' => 'sometimes|required|string|max:255',
            'email' => 'nullable|email|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        if (!$crm) {
            if (!$this->firestore->isConfigured()) {
                return response()->json(['message' => 'Contact not found'], 404);
            }

            $existingRemote = $this->firestore->find($id);
            if ($existingRemote === null) {
                return response()->json(['message' => 'Contact not found'], 404);
            }

            $updatedRemote = array_merge($existingRemote, $data, ['id' => $existingRemote['id'] ?? $id]);
            $ok = $this->firestore->sync($id, $updatedRemote);
            if (!$ok) {
                return response()->json(['message' => 'Failed to update contact in Firestore'], 502);
            }

            $this->safeNotifyScheduleChangesFromPayload($existingRemote, $updatedRemote, $id);

            return response()->json(array_merge(
                $updatedRemote,
                $this->buildCalendarWarningPayload(
                    $this->remoteOnlyCalendarSyncWarnings($existingRemote, $updatedRemote)
                )
            ));
        }

        $before = $this->crmNotificationPayload($crm->toArray(), $crm->id);
        $crm->update($data);
        $calendarWarnings = $this->syncExternalSystems($crm, false);
        $freshCrm = $crm->fresh() ?? $crm;
        $this->safeNotifyScheduleChangesFromPayload($before, $this->crmNotificationPayload($freshCrm->toArray(), $crm->id));

        return response()->json($this->buildCrmResponsePayload($freshCrm, $calendarWarnings));
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy($id): JsonResponse
    {
        $adminCheck = $this->ensureAdmin('Only admin users can delete contacts.');
        if ($adminCheck) {
            return $adminCheck;
        }

        $crm = $this->findCrm($id);
        if (!$crm) {
            if ($this->firestore->isConfigured()) {
                $this->safeDeleteFromFirestore($id);
                return response()->json(null, 204);
            }

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
        $adminCheck = $this->ensureAdmin('Only admin users can delete contacts.');
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

    protected function syncExternalSystems(Crm $crm, bool $sendScheduleNotifications = true): array
    {
        $calendarWarnings = $this->safeSyncCalendarReminders($crm, $sendScheduleNotifications);
        $this->safeSyncToFirestore($crm);

        return $calendarWarnings;
    }

    protected function safeSyncCalendarReminders(Crm $crm, bool $sendScheduleNotifications = true): array
    {
        try {
            $this->calendarReminder->syncForCrm($crm, $sendScheduleNotifications, auth()->user());
            return $this->calendarReminder->getLastSyncWarnings();
        } catch (\Throwable $e) {
            Log::warning('Calendar reminder sync failed but CRM data was saved.', [
                'crm_id' => $crm->id,
                'error' => $e->getMessage(),
            ]);

            return ['CRM saved, but Outlook calendar sync failed: ' . $e->getMessage()];
        }
    }

    protected function safeNotifyScheduleChangesFromPayload(array $before, array $after, int|string|null $crmId = null): void
    {
        try {
            $this->calendarReminder->notifyScheduleChangesFromPayload($before, $after);
        } catch (\Throwable $e) {
            Log::warning('Calendar reminder notification failed after CRM save.', [
                'crm_id' => $crmId ?? ($after['id'] ?? null),
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

    protected function buildCrmResponsePayload(Crm $crm, array $calendarWarnings = []): array
    {
        return array_merge(
            $crm->toArray(),
            $this->buildCalendarWarningPayload($calendarWarnings)
        );
    }

    protected function buildCalendarWarningPayload(array $calendarWarnings = []): array
    {
        $warnings = array_values(array_unique(array_filter(array_map(
            fn ($warning) => trim((string) $warning),
            $calendarWarnings
        ))));

        return [
            'calendar_sync_warning' => $warnings[0] ?? null,
            'calendar_sync_warnings' => $warnings,
        ];
    }

    protected function remoteOnlyCalendarSyncWarnings(array $before, array $after): array
    {
        $scheduleChanged = ($before['appointment'] ?? null) !== ($after['appointment'] ?? null)
            || ($before['follow_up'] ?? null) !== ($after['follow_up'] ?? null);

        $user = auth()->user();
        $hasOutlookConnection = $user && method_exists($user, 'microsoftCalendarConnection')
            ? $user->microsoftCalendarConnection()->exists()
            : false;

        if (!$scheduleChanged || !$hasOutlookConnection) {
            return [];
        }

        return [
            'CRM saved, but Outlook sync was skipped because this contact exists only in Firestore. Create a new contact or resave it after the database-backed record exists.',
        ];
    }
}
