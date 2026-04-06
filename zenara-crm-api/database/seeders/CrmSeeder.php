<?php

namespace Database\Seeders;

use App\Models\Crm;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class CrmSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        if (Crm::query()->exists()) {
            return;
        }

        // Create 30 sample CRMs
        Crm::factory()->count(30)->create();
    }
}
