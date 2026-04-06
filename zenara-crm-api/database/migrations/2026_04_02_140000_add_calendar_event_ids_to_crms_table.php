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
        Schema::table('crms', function (Blueprint $table) {
            $table->string('appointment_google_event_id')->nullable()->after('appointment');
            $table->string('appointment_ms_event_id')->nullable()->after('appointment_google_event_id');
            $table->string('follow_up_google_event_id')->nullable()->after('follow_up');
            $table->string('follow_up_ms_event_id')->nullable()->after('follow_up_google_event_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('crms', function (Blueprint $table) {
            $table->dropColumn([
                'appointment_google_event_id',
                'appointment_ms_event_id',
                'follow_up_google_event_id',
                'follow_up_ms_event_id',
            ]);
        });
    }
};
