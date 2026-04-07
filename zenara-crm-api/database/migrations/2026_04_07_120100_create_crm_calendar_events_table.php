<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('crm_calendar_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('crm_id')->constrained('crms')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('provider');
            $table->string('event_type');
            $table->string('external_event_id');
            $table->timestamp('last_synced_at')->nullable();
            $table->timestamps();

            $table->unique(['crm_id', 'user_id', 'provider', 'event_type'], 'crm_calendar_events_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('crm_calendar_events');
    }
};
