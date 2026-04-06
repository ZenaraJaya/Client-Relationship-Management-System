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
            $table->dateTime('appointment_pre_reminder_for_at')->nullable()->after('appointment_reminder_sent_on');
            $table->dateTime('appointment_due_reminder_for_at')->nullable()->after('appointment_pre_reminder_for_at');
            $table->dateTime('follow_up_pre_reminder_for_at')->nullable()->after('follow_up_reminder_sent_on');
            $table->dateTime('follow_up_due_reminder_for_at')->nullable()->after('follow_up_pre_reminder_for_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('crms', function (Blueprint $table) {
            $table->dropColumn([
                'appointment_pre_reminder_for_at',
                'appointment_due_reminder_for_at',
                'follow_up_pre_reminder_for_at',
                'follow_up_due_reminder_for_at',
            ]);
        });
    }
};
