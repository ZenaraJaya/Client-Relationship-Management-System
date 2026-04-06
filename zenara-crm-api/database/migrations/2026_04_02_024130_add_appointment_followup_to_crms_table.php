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
            $table->timestamp('appointment')->nullable();
            $table->timestamp('follow_up')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('crms', function (Blueprint $table) {
            $table->dropColumn(['appointment', 'follow_up']);
        });
    }
};
