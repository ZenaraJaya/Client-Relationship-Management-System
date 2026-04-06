<?php

namespace Database\Factories;

use App\Models\Crm;
use Illuminate\Database\Eloquent\Factories\Factory;

class CrmFactory extends Factory
{
    protected $model = Crm::class;

    public function definition()
    {
        $faker = $this->faker;

        return [
            'company_name' => $faker->company,
            'industry' => $faker->randomElement(['Software', 'Retail', 'Healthcare', 'Finance']),
            'location' => $faker->city . ', ' . $faker->country,
            'contact_person' => $faker->name,
            'role' => $faker->jobTitle,
            'phone' => $faker->phoneNumber,
            'email' => $faker->companyEmail,
            'source' => $faker->randomElement(['Referral', 'Cold Call', 'Website', 'Event']),
            'pain_point' => $faker->sentence,
            'remarks' => $faker->optional()->sentence,
            'priority' => $faker->randomElement(['Low','Medium','High']),
            'status' => $faker->randomElement(['New','Contacted','Qualified','Closed']),
            'last_contact' => $faker->dateTimeBetween('-90 days', 'now'),
            'next_action' => $faker->sentence,
        ];
    }
}
