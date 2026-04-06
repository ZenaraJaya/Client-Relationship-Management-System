<?php

namespace App\Services;

use Google\Auth\Credentials\ServiceAccountCredentials;
use Illuminate\Support\Facades\Log;

class FirestoreService
{
    protected $projectId;
    protected $token;
    protected $collection = 'crms';

    public function __construct()
    {
        $credentialPath = config('services.firebase.credentials')
            ?: config('services.google_calendar.credentials');
        $jsonPath = $this->resolveCredentialPath($credentialPath);

        if (!$jsonPath) {
            Log::error('FirestoreService: Service account JSON path is missing or invalid.');
            return;
        }

        $config = json_decode(file_get_contents($jsonPath), true) ?: [];
        $this->projectId = (string) (
            config('services.firebase.project_id')
            ?: ($config['project_id'] ?? '')
        );

        try {
            $scopes = ['https://www.googleapis.com/auth/datastore'];
            $credentials = new ServiceAccountCredentials($scopes, $jsonPath);
            $authToken = $this->fetchAuthTokenWithoutProxy($credentials);
            $this->token = $authToken['access_token'] ?? null;
        } catch (\Exception $e) {
            Log::error("FirestoreService: Failed to get OAuth2 token: " . $e->getMessage());
        }
    }

    protected function resolveCredentialPath(?string $path): ?string
    {
        if (!$path) {
            return null;
        }

        $candidate = str_starts_with($path, DIRECTORY_SEPARATOR) || preg_match('/^[A-Za-z]:[\\\\\\/]/', $path)
            ? $path
            : base_path($path);

        if (!is_file($candidate)) {
            Log::error("FirestoreService: Service account JSON not found at {$candidate}");
            return null;
        }

        return $candidate;
    }

    protected function fetchAuthTokenWithoutProxy(ServiceAccountCredentials $credentials): array
    {
        $originalNoProxy = getenv('NO_PROXY');
        $originalNoProxyLower = getenv('no_proxy');

        // Force direct auth token exchange to avoid bad local proxy env values.
        putenv('NO_PROXY=*');
        putenv('no_proxy=*');

        try {
            return $credentials->fetchAuthToken();
        } finally {
            $this->restoreEnvValue('NO_PROXY', $originalNoProxy);
            $this->restoreEnvValue('no_proxy', $originalNoProxyLower);
        }
    }

    protected function restoreEnvValue(string $key, string|false $value): void
    {
        if ($value === false) {
            putenv($key);
            return;
        }

        putenv("{$key}={$value}");
    }

    protected function getCollection(?string $collection = null): string
    {
        $value = trim((string) ($collection ?? $this->collection));
        return $value !== '' ? $value : $this->collection;
    }

    public function sync($id, array $data, ?string $collection = null)
    {
        if (!$this->token || !$this->projectId) return false;

        $targetCollection = $this->getCollection($collection);
        $url = "https://firestore.googleapis.com/v1/projects/{$this->projectId}/databases/(default)/documents/{$targetCollection}/{$id}";
        
        $fields = [];
        foreach ($data as $key => $value) {
            if ($value === null) {
                // Keep null fields in Firestore so clearing a value (e.g. date fields)
                // doesn't leave stale data behind.
                $fields[$key] = ['nullValue' => null];
                continue;
            }

            if (is_bool($value)) {
                $fields[$key] = ['booleanValue' => $value];
                continue;
            }

            if (is_int($value)) {
                $fields[$key] = ['integerValue' => (string) $value];
                continue;
            }

            if (is_float($value)) {
                $fields[$key] = ['doubleValue' => $value];
                continue;
            }

            $fields[$key] = ['stringValue' => (string) $value];
        }

        $json = json_encode(['fields' => $fields]);
        
        // Construct the updateMask query parameters manually
        // We need multiple updateMask.fieldPaths=key instead of updateMask.fieldPaths[0]=key
        $maskParts = [];
        foreach (array_keys($fields) as $field) {
            $maskParts[] = 'updateMask.fieldPaths=' . urlencode($field);
        }
        $query = implode('&', $maskParts);

        return $this->call($url . '?' . $query, 'PATCH', $json);
    }

    public function delete($id, ?string $collection = null)
    {
        if (!$this->token || !$this->projectId) return false;

        $targetCollection = $this->getCollection($collection);
        $url = "https://firestore.googleapis.com/v1/projects/{$this->projectId}/databases/(default)/documents/{$targetCollection}/{$id}";
        
        return $this->call($url, 'DELETE');
    }

    protected function call($url, $method, $json = null)
    {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 4);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        curl_setopt($ch, CURLOPT_NOPROXY, '*');
        
        $headers = [
            "Authorization: Bearer {$this->token}",
            "Content-Type: application/json"
        ];

        if ($json) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $json);
        }

        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode >= 200 && $httpCode < 300) {
            return true;
        }

        Log::error("Firestore REST Error ($method $httpCode): " . $response);
        return false;
    }
}
