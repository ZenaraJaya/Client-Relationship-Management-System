<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Crm extends Model
{
    use HasFactory;

    protected $table = 'crms';

    protected $fillable = [
        'user_id',
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

    protected $casts = [
        'user_id' => 'integer',
        'last_contact' => 'datetime',
        'appointment' => 'datetime',
        'follow_up' => 'datetime',
        'appointment_reminder_sent_on' => 'date',
        'follow_up_reminder_sent_on' => 'date',
        'appointment_pre_reminder_for_at' => 'datetime',
        'appointment_due_reminder_for_at' => 'datetime',
        'follow_up_pre_reminder_for_at' => 'datetime',
        'follow_up_due_reminder_for_at' => 'datetime',
    ];

    protected $hidden = [
        'appointment_google_event_id',
        'appointment_ms_event_id',
        'follow_up_google_event_id',
        'follow_up_ms_event_id',
        'appointment_reminder_sent_on',
        'follow_up_reminder_sent_on',
        'appointment_pre_reminder_for_at',
        'appointment_due_reminder_for_at',
        'follow_up_pre_reminder_for_at',
        'follow_up_due_reminder_for_at',
    ];
}
