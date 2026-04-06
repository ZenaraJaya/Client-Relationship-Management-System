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

        $industries = ['Software', 'Retail', 'Healthcare', 'Finance', 'Education', 'Logistics'];
        $locations = ['Kuala Lumpur, Malaysia', 'Penang, Malaysia', 'Johor Bahru, Malaysia', 'Shah Alam, Malaysia'];
        $roles = ['CEO', 'Operations Manager', 'Sales Director', 'Marketing Lead', 'Founder'];
        $sources = ['Referral', 'Cold Call', 'Website', 'Event'];
        $priorities = ['Low', 'Medium', 'High'];
        $statuses = ['New', 'Contacted', 'Qualified', 'Closed'];

        $records = [];
        $now = now();

        for ($i = 1; $i <= 30; $i++) {
            $records[] = [
                'company_name' => "Sample Company {$i}",
                'industry' => $industries[array_rand($industries)],
                'location' => $locations[array_rand($locations)],
                'contact_person' => "Contact {$i}",
                'role' => $roles[array_rand($roles)],
                'phone' => '+60 1' . random_int(10000000, 99999999),
                'email' => "contact{$i}@example.com",
                'source' => $sources[array_rand($sources)],
                'pain_point' => 'Need better lead tracking and faster customer follow-up.',
                'remarks' => $i % 3 === 0 ? 'Interested in monthly package.' : null,
                'priority' => $priorities[array_rand($priorities)],
                'status' => $statuses[array_rand($statuses)],
                'last_contact' => $now->copy()->subDays(random_int(1, 90)),
                'next_action' => 'Schedule follow-up call',
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        Crm::query()->insert($records);
    }
}
