<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CrmCalendarEvent extends Model
{
    use HasFactory;

    protected $fillable = [
        'crm_id',
        'user_id',
        'provider',
        'event_type',
        'external_event_id',
        'last_synced_at',
    ];

    protected function casts(): array
    {
        return [
            'last_synced_at' => 'datetime',
        ];
    }

    public function crm(): BelongsTo
    {
        return $this->belongsTo(Crm::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
