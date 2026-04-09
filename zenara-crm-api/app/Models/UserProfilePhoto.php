<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserProfilePhoto extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'mime_type',
        'content_base64',
    ];

    protected $hidden = [
        'content_base64',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

