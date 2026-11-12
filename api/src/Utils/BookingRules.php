<?php

declare(strict_types=1);

namespace App\Utils;

use App\Config\Database;
use App\Models\SystemScheduleModel;
use PDO;

/**
 * Single source of truth for the reservation life cycle and the booking rules
 * (blocked days/hours and service area) that the website also checks in the browser.
 *
 *   PENDING ──quote──▶ QUOTED ──customer/admin confirm──▶ CONFIRMED ──▶ ON_THE_WAY ──▶ INITIATED ──▶ COMPLETED
 *      │                 │  ▲                                │  ▲
 *      │                 ▼  │ (new price)                    ▼  │ (confirm new date)
 *      │              RESCHEDULED ◀──────────────────────────┘──┘
 *      └──▶ REJECTED (we can't take it)        any open status ──▶ CANCELLED
 */
final class BookingRules
{
    public const STATUSES = ['PENDING', 'QUOTED', 'CONFIRMED', 'ON_THE_WAY', 'INITIATED', 'RESCHEDULED', 'COMPLETED', 'CANCELLED', 'REJECTED'];

    /** Final states: nothing can change any more */
    public const CLOSED = ['COMPLETED', 'CANCELLED', 'REJECTED'];

    /** States in which the cleaner is expected to go to the address */
    public const JOB_ACTIVE = ['CONFIRMED', 'ON_THE_WAY', 'INITIATED'];

    /** What the admin panel may do from each state (same state = edit details/price/staff) */
    private const ADMIN = [
        'PENDING'     => ['PENDING', 'QUOTED', 'CONFIRMED', 'RESCHEDULED', 'CANCELLED', 'REJECTED'],
        'QUOTED'      => ['QUOTED', 'CONFIRMED', 'RESCHEDULED', 'CANCELLED', 'REJECTED'],
        'CONFIRMED'   => ['CONFIRMED', 'QUOTED', 'RESCHEDULED', 'ON_THE_WAY', 'INITIATED', 'COMPLETED', 'CANCELLED'],
        'RESCHEDULED' => ['RESCHEDULED', 'QUOTED', 'CONFIRMED', 'CANCELLED', 'REJECTED'],
        'ON_THE_WAY'  => ['ON_THE_WAY', 'INITIATED', 'COMPLETED', 'CANCELLED'],
        'INITIATED'   => ['INITIATED', 'COMPLETED'],
    ];

    /** The cleaner can only move a confirmed job forward */
    private const STAFF = [
        'CONFIRMED'  => ['ON_THE_WAY', 'INITIATED'],
        'ON_THE_WAY' => ['INITIATED'],
        'INITIATED'  => ['COMPLETED'],
    ];

    public static function adminCan(string $from, string $to): bool
    {
        return in_array($to, self::ADMIN[$from] ?? [], true);
    }

    /** Returns an error message, or null when the cleaner may make this change. */
    public static function staffError(string $from, string $to, string $serviceDate): ?string
    {
        if (!in_array($to, self::STAFF[$from] ?? [], true)) {
            return match (true) {
                in_array($from, self::CLOSED, true) => 'This job is already closed.',
                !in_array($from, self::JOB_ACTIVE, true) => 'This job is not confirmed yet. Please wait for the office to confirm it.',
                default => 'Please follow the order: On the way, Started, Completed.',
            };
        }
        if ($serviceDate > date('Y-m-d')) {
            return 'You can only update this job on the day of the service (' . date('M j', strtotime($serviceDate)) . ').';
        }
        return null;
    }

    /** True when the appointment starts in less than $hours (used for the free change/cancel window). */
    public static function isWithin(string $date, string $time, int $hours = 48): bool
    {
        $start = strtotime($date . ' ' . ($time ?: '00:00'));
        return $start !== false && $start - time() < $hours * 3600;
    }

    /**
     * Checks a date/time against the Global System schedule and the service's own blocked days/hours.
     * Returns a customer-friendly error, or null when the slot is allowed.
     */
    public static function scheduleError(string $date, string $time, ?array $service = null): ?string
    {
        $schedule = (new SystemScheduleModel())->getSchedule();
        $dayOfWeek = (int)date('w', strtotime($date));
        $minutes = self::minutes($time);

        if (in_array($date, self::list($schedule['blocked_specific_dates'] ?? []), true)) {
            return 'We are closed on that date. Please choose another day.';
        }
        if (in_array($dayOfWeek, array_map('intval', self::list($schedule['global_blocked_days'] ?? [])), true)) {
            return 'We do not take bookings on that day of the week. Please choose another day.';
        }
        if (self::inWindow($minutes, $schedule['global_block_time_start'] ?? '', $schedule['global_block_time_end'] ?? '')) {
            return 'That time is not available. Please choose another time.';
        }
        if ($service) {
            if (in_array($dayOfWeek, array_map('intval', self::list($service['blocked_days'] ?? [])), true)) {
                return 'This service is not available on that day of the week. Please choose another day.';
            }
            if (self::inWindow($minutes, (string)($service['block_time_start'] ?? ''), (string)($service['block_time_end'] ?? ''))) {
                return 'This service cannot be scheduled at that time. Please choose another time.';
            }
        }
        return null;
    }

    /** True when the address mentions one of the active cities/areas (same rule as the website form). */
    public static function inServiceArea(string $address): bool
    {
        try {
            $db = (new Database())->getConnection();
            $names = $db->query("
                SELECT z.city_name AS name FROM service_zones z WHERE z.is_active = 1
                UNION
                SELECT a.area_name FROM service_zone_areas a JOIN service_zones z ON z.id = a.zone_id
                WHERE z.is_active = 1 AND a.is_active = 1
            ")->fetchAll(PDO::FETCH_COLUMN);
        } catch (\Throwable $e) {
            error_log('Service area check skipped: ' . $e->getMessage());
            return true; // never block bookings because of a lookup problem
        }

        $names = array_filter(array_map(static fn($n) => mb_strtolower(trim((string)$n)), $names));
        if (!$names) {
            return true;
        }
        $address = mb_strtolower($address);
        foreach ($names as $name) {
            if (preg_match('/\b' . preg_quote($name, '/') . '\b/u', $address)) {
                return true;
            }
        }
        return false;
    }

    private static function list(mixed $value): array
    {
        if (is_string($value)) {
            $value = json_decode($value, true);
        }
        return is_array($value) ? $value : [];
    }

    private static function minutes(string $time): int
    {
        [$h, $m] = array_map('intval', explode(':', $time . ':0'));
        return $h * 60 + $m;
    }

    private static function inWindow(int $minutes, string $start, string $end): bool
    {
        if ($start === '' || $end === '') {
            return false;
        }
        return $minutes >= self::minutes($start) && $minutes <= self::minutes($end);
    }
}
