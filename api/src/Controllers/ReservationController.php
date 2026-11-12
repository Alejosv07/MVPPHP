<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Models\AuditModel;
use App\Models\ReservationModel;
use App\Utils\Auth;
use App\Utils\BookingRules;
use App\Utils\EmailService;
use App\Utils\RateLimiter;
use App\Utils\Response;
use Exception;

/**
 * Access rules (router + this class):
 *  - POST without token: public booking request (forced to PENDING, no price, no staff)
 *  - Everything else: ADMIN, or STAFF limited to their own assignments
 * Allowed status changes live in BookingRules.
 */
class ReservationController
{
    /** Statuses a cleaner never sees: nothing to do yet / never happening */
    private const HIDDEN_FROM_STAFF = ['PENDING', 'QUOTED', 'REJECTED'];
    private const FREQUENCIES = ['One-time', 'Weekly', 'Bi-weekly', 'Biweekly', 'Monthly'];

    private ReservationModel $model;
    private AuditModel $auditModel;

    public function __construct()
    {
        $this->model = new ReservationModel();
        $this->auditModel = new AuditModel();
    }

    private function input(): array
    {
        $data = json_decode(file_get_contents('php://input'), true);
        return is_array($data) ? $data : [];
    }

    public function handle(string $method, ?int $id, ?string $subResource): void
    {
        if ($subResource === 'history' && $id) {
            $this->assertCanAccess($id);
            Response::json($this->model->getHistory($id));
        }

        match ($method) {
            'GET'   => $id ? $this->getOne($id) : $this->getAllFiltered(),
            'POST'  => $this->create(),
            'PUT'   => $id ? $this->update($id) : Response::json(['message' => 'ID is required'], 400),
            default => Response::json(['message' => 'Method not allowed'], 405)
        };
    }

    public function publicReviews(): void
    {
        Response::json($this->model->getPublicReviews());
    }

    /** STAFF may only touch reservations assigned to them. Returns the reservation. */
    private function assertCanAccess(int $id): array
    {
        $reservation = $this->model->getById($id);
        if (!$reservation) {
            Response::json(['message' => 'Reservation not found'], 404);
        }
        if (Auth::isStaff() && ((int)($reservation['staff_id'] ?? 0) !== Auth::userId()
            || in_array($reservation['status'], self::HIDDEN_FROM_STAFF, true))) {
            Response::json(['message' => 'Reservation not found'], 404);
        }
        return $reservation;
    }

    private function getAllFiltered(): void
    {
        $month = isset($_GET['month']) ? (int)$_GET['month'] : null;
        $year = isset($_GET['year']) ? (int)$_GET['year'] : null;
        $search = isset($_GET['search']) ? mb_substr(trim((string)$_GET['search']), 0, 100) : null;

        // Staff always see only their own jobs, whatever the client sends
        $staffId = Auth::isStaff()
            ? Auth::userId()
            : (isset($_GET['staff_id']) ? (int)$_GET['staff_id'] : null);

        $rows = ($month && $year)
            ? $this->model->getByMonthAndYear($month, $year, $staffId, $search)
            : $this->model->getAll($staffId, $search);

        if (Auth::isStaff()) {
            $rows = array_values(array_filter($rows, static fn(array $r) => !in_array($r['status'], self::HIDDEN_FROM_STAFF, true)));
        }
        Response::json($rows);
    }

    private function getOne(int $id): void
    {
        Response::json($this->assertCanAccess($id));
    }

    private function validateBooking(array $data): ?string
    {
        $required = ['first_name', 'last_name', 'email', 'phone_number', 'service_id', 'service_date', 'preferred_time', 'service_address'];
        foreach ($required as $field) {
            if (!isset($data[$field]) || trim((string)$data[$field]) === '') {
                return "The field {$field} is required";
            }
        }
        if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
            return 'Invalid email address';
        }
        $date = \DateTimeImmutable::createFromFormat('!Y-m-d', (string)$data['service_date']);
        if (!$date || $date->format('Y-m-d') !== (string)$data['service_date']) {
            return 'Invalid service date';
        }
        if (!preg_match('/^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/', (string)$data['preferred_time'])) {
            return 'Invalid preferred time';
        }
        if (!ctype_digit((string)$data['service_id'])) {
            return 'Invalid service';
        }
        $service = (new \App\Models\ServiceModel())->getById((int)$data['service_id']);
        if (!$service) {
            return 'The selected service is not available';
        }
        // Customers can only book services that are currently offered
        if (Auth::user() === null && isset($service['is_active']) && !(int)$service['is_active']) {
            return 'The selected service is not available';
        }
        if (!preg_match('/^[0-9+()\-.\s]{7,20}$/', (string)$data['phone_number'])) {
            return 'Invalid phone number';
        }
        foreach (['first_name' => 80, 'last_name' => 80, 'service_address' => 255, 'special_instructions' => 2000] as $field => $max) {
            if (isset($data[$field]) && mb_strlen((string)$data[$field]) > $max) {
                return "The field {$field} is too long";
            }
        }
        return null;
    }

    private function create(): void
    {
        $data = $this->input();
        $isStaffUser = Auth::user() !== null;

        if ($isStaffUser) {
            Auth::require(['ADMIN']);
        } else {
            // Anonymous booking form
            RateLimiter::hit('booking-ip', Auth::clientIp(), 10, 3600);

            if (empty($data['accept_terms'])) {
                Response::json(['message' => 'You must accept the Terms of Service and Privacy Policy'], 422);
            }
            $requested = (string)($data['service_date'] ?? '');
            if ($requested < date('Y-m-d')) {
                Response::json(['message' => 'The service date cannot be in the past'], 422);
            }
            if ($requested > date('Y-m-d', strtotime('+1 year'))) {
                Response::json(['message' => 'Please choose a date within the next 12 months'], 422);
            }

            $data['status'] = 'PENDING';
            $data['total_price'] = 0.00;
            unset($data['staff_id'], $data['user_id']);
        }

        if ($error = $this->validateBooking($data)) {
            Response::json(['message' => $error], 422);
        }

        if (!$isStaffUser) {
            // Same rules as the website form, enforced here so they can't be skipped
            $service = (new \App\Models\ServiceModel())->getById((int)$data['service_id']);
            if ($error = BookingRules::scheduleError((string)$data['service_date'], (string)$data['preferred_time'], $service)) {
                Response::json(['message' => $error], 422);
            }
            if (!BookingRules::inServiceArea((string)$data['service_address'])) {
                Response::json(['message' => 'Sorry, this address is outside our service area.'], 422);
            }
        }

        $data['email'] = strtolower(trim((string)$data['email']));
        $data['bedrooms'] = max(0, min(20, (float)($data['bedrooms'] ?? 1)));
        $data['bathrooms'] = max(0, min(20, (float)($data['bathrooms'] ?? 1)));
        if (!in_array($data['frequency'] ?? 'One-time', self::FREQUENCIES, true)) {
            $data['frequency'] = 'One-time';
        }
        // The admin can create a request (PENDING), send a quote right away (QUOTED, needs a price)
        // or book directly (CONFIRMED, e.g. agreed by phone)
        $data['total_price'] = max(0, min(100000, (float)($data['total_price'] ?? 0)));
        if (!in_array($data['status'] ?? 'PENDING', ['PENDING', 'QUOTED', 'CONFIRMED'], true)) {
            $data['status'] = 'PENDING';
        }
        if ($data['status'] === 'PENDING' && $data['total_price'] > 0) {
            $data['status'] = 'QUOTED';
        }
        if ($data['status'] !== 'PENDING' && $data['total_price'] <= 0) {
            Response::json(['message' => 'Set a price before sending a quote or confirming'], 422);
        }
        $data['user_id'] = Auth::userId();

        try {
            $id = $this->model->createWithCustomer($data);
            if (!$isStaffUser) {
                $this->model->recordConsent($id, !empty($data['sms_consent']), Auth::clientIp());
            }
            $reservation = $this->model->getById($id);
            if ($reservation) {
                // Website requests are always PENDING; admin-created bookings get the email of their status
                EmailService::sendStatusUpdateEmail($reservation, (string)$reservation['status']);
                if (!$isStaffUser) {
                    EmailService::sendNewBookingAlert($reservation); // only for website requests
                }
            }

            Response::json(['message' => 'Reservation created successfully', 'id' => $id], 201);
        } catch (Exception $e) {
            error_log('Reservation create failed: ' . $e->getMessage());
            Response::json(['message' => 'We could not save your request. Please try again or contact us.'], 500);
        }
    }

    private function update(int $id): void
    {
        $current = $this->assertCanAccess($id);
        $payload = $this->input();

        if (isset($payload['status']) && !isset($payload['first_name'])) {
            $this->updateStatusOnly($id, $payload, $current);
            return;
        }

        Auth::require(['ADMIN']); // full edits are admin-only

        if (in_array($current['status'], BookingRules::CLOSED, true)) {
            Response::json(['message' => 'This reservation is closed and can no longer be edited'], 409);
        }
        if ($error = $this->validateBooking($payload)) {
            Response::json(['message' => $error], 422);
        }
        // Price and status are changed only through the quote/confirm/cancel actions
        unset($payload['total_price'], $payload['status']);
        $payload['email'] = strtolower(trim((string)$payload['email']));

        try {
            if (!$this->model->update($id, $payload)) {
                Response::json(['message' => 'Reservation not found or no changes made'], 404);
            }
            $after = $this->model->getById($id) ?? $current;

            $changes = $this->describeChanges($current, $after);
            $this->log('UPDATE', $id, ['method' => 'ADMIN_EDIT', 'changes' => $changes]);

            if ($changes) {
                $this->model->addHistory($id, Auth::userId(), $current['status'], $current['status'], 'Details edited by admin: ' . implode('; ', $changes));

                // Customer: only when there is something for them to act on or to know (new date, address, links)
                $customerRelevant = array_filter($changes, static fn(string $c) => !str_starts_with($c, 'notes') && !str_starts_with($c, 'home'));
                if ($customerRelevant && in_array($after['status'], ['QUOTED', 'CONFIRMED', 'RESCHEDULED'], true)) {
                    EmailService::sendStatusUpdateEmail($after, $after['status'], ['updated' => true]);
                }
                EmailService::notifyStaffOfChange($current, $after);
            }

            Response::json(['message' => 'Reservation updated successfully']);
        } catch (Exception $e) {
            error_log('Reservation update failed: ' . $e->getMessage());
            Response::json(['message' => 'Error updating reservation'], 500);
        }
    }

    /** Human-readable list of what an admin edit changed (for history and to decide who to email). */
    private function describeChanges(array $before, array $after): array
    {
        $fields = [
            'service_date' => 'date', 'service_address' => 'address', 'service_id' => 'service',
            'email' => 'email', 'special_instructions' => 'notes',
        ];
        $changes = [];
        foreach ($fields as $field => $label) {
            if ((string)($before[$field] ?? '') !== (string)($after[$field] ?? '')) {
                $changes[] = "{$label}: " . ($before[$field] ?? '-') . ' → ' . ($after[$field] ?? '-');
            }
        }
        if (substr((string)$before['preferred_time'], 0, 5) !== substr((string)$after['preferred_time'], 0, 5)) {
            $changes[] = 'time: ' . substr((string)$before['preferred_time'], 0, 5) . ' → ' . substr((string)$after['preferred_time'], 0, 5);
        }
        if ((string)$before['bedrooms'] !== (string)$after['bedrooms'] || (string)$before['bathrooms'] !== (string)$after['bathrooms']) {
            $changes[] = "home: {$before['bedrooms']} bed/{$before['bathrooms']} bath → {$after['bedrooms']} bed/{$after['bathrooms']} bath";
        }
        return $changes;
    }

    private function updateStatusOnly(int $id, array $data, array $current): void
    {
        $from = (string)$current['status'];
        $status = strtoupper(trim((string)($data['status'] ?? '')));

        if (!in_array($status, BookingRules::STATUSES, true)) {
            Response::json(['message' => 'Invalid status'], 422);
        }

        $isStaff = Auth::isStaff();
        if ($isStaff) {
            if ($error = BookingRules::staffError($from, $status, (string)$current['service_date'])) {
                Response::json(['message' => $error], 409);
            }
        } elseif (!BookingRules::adminCan($from, $status)) {
            $label = static fn(string $s) => ucwords(strtolower(str_replace('_', ' ', $s)));
            $message = in_array($from, BookingRules::CLOSED, true)
                ? "This reservation is {$label($from)} and can no longer be changed"
                : "A reservation can't go from {$label($from)} to {$label($status)}";
            Response::json(['message' => $message], 409);
        }

        // Cleaners can only move the status; price, date, time and assignment are office decisions
        $totalPrice = (!$isStaff && isset($data['total_price']) && $data['total_price'] !== '') ? round((float)$data['total_price'], 2) : null;
        $serviceDate = (!$isStaff && !empty($data['service_date'])) ? (string)$data['service_date'] : null;
        $preferredTime = (!$isStaff && !empty($data['preferred_time'])) ? (string)$data['preferred_time'] : null;
        $staffGiven = !$isStaff && array_key_exists('staff_id', $data);
        $staffId = $staffGiven && !empty($data['staff_id']) ? (int)$data['staff_id'] : null;
        $unassign = $staffGiven && $staffId === null;
        $reason = $isStaff ? '' : mb_substr(trim((string)($data['reason'] ?? '')), 0, 500);

        if ($serviceDate !== null && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $serviceDate)) {
            Response::json(['message' => 'Invalid service date'], 422);
        }
        if ($preferredTime !== null && !preg_match('/^\d{1,2}:\d{2}(:\d{2})?$/', $preferredTime)) {
            Response::json(['message' => 'Invalid preferred time'], 422);
        }
        if ($totalPrice !== null && ($totalPrice < 0 || $totalPrice > 100000)) {
            Response::json(['message' => 'Invalid price'], 422);
        }
        if ($staffId !== null && !$this->model->isAssignableUser($staffId)) {
            Response::json(['message' => 'That team member does not exist or is inactive'], 422);
        }

        $finalPrice = $totalPrice ?? (float)$current['total_price'];
        $priceChanged = $totalPrice !== null && abs($totalPrice - (float)$current['total_price']) > 0.001;
        $dateChanged = ($serviceDate !== null && $serviceDate !== $current['service_date'])
            || ($preferredTime !== null && substr($preferredTime, 0, 5) !== substr((string)$current['preferred_time'], 0, 5));

        if (!$isStaff) {
            if (in_array($status, ['QUOTED', 'CONFIRMED'], true) && $finalPrice <= 0) {
                Response::json(['message' => 'Set a price first'], 422);
            }
            // A new price must be accepted by the customer again (or confirmed on their behalf)
            if ($priceChanged && !($status === 'QUOTED' || ($status === 'CONFIRMED' && $from !== 'CONFIRMED'))) {
                Response::json(['message' => 'To change the price, send a new quote'], 422);
            }
            if ($status === 'RESCHEDULED' && $from !== 'RESCHEDULED' && !$dateChanged) {
                Response::json(['message' => 'Choose a different date or time to reschedule'], 422);
            }
            if ($dateChanged && ($serviceDate ?? $current['service_date']) < date('Y-m-d')) {
                Response::json(['message' => 'The new date cannot be in the past'], 422);
            }
        }

        $comment = mb_substr(trim((string)($data['comment'] ?? '')), 0, 300) ?: ($isStaff ? "Updated by cleaner" : 'Updated via admin panel');
        if ($reason !== '') {
            $comment .= " Reason: {$reason}";
        }

        try {
            $success = $this->model->updateStatusWithDetails($id, $status, Auth::userId(), $comment, $totalPrice, $serviceDate, $preferredTime, $staffId, $unassign);
            if (!$success) {
                Response::json(['message' => 'Reservation not found'], 404);
            }

            $this->log('UPDATE', $id, ['previous_status' => $from, 'new_status' => $status]);

            $after = $this->model->getById($id);
            if ($after) {
                $this->notifyChanges($current, $after, $priceChanged, $dateChanged, $reason);
            }
            Response::json(['message' => 'Reservation updated successfully', 'status' => $status]);
        } catch (Exception $e) {
            error_log('Reservation status update failed: ' . $e->getMessage());
            $pendingMigration = $e instanceof \RuntimeException && str_contains($e->getMessage(), 'migration');
            Response::json(['message' => $pendingMigration
                ? 'The database needs an update before this action can be used (run the pending migration).'
                : 'Error updating status'], 500);
        }
    }

    /**
     * Emails only what changed, to the right person:
     *  - customer: new status, or new price/date/time on the same status ("updated details")
     *  - cleaners: see EmailService::notifyStaffOfChange (they only hear about confirmed jobs)
     *  - office: when a cleaner finishes a job
     */
    private function notifyChanges(array $before, array $after, bool $priceChanged, bool $dateChanged, string $reason): void
    {
        $status = (string)$after['status'];
        $statusChanged = $status !== $before['status'];

        if ($statusChanged || $priceChanged || $dateChanged) {
            EmailService::sendStatusUpdateEmail($after, $status, [
                'updated' => !$statusChanged,
                'reason'  => $reason,
                'from'    => $before['status'],
            ]);
        }

        if (Auth::isStaff()) {
            if ($status === 'COMPLETED') {
                $staff = trim((string)($after['staff_name'] ?? 'The cleaner'));
                EmailService::sendTeamAlert($after, "Job " . sprintf('#RES-%04d', (int)$after['id']) . " completed by {$staff}",
                    'The customer has been asked to rate the service.');
            }
            return; // cleaners moving their own job need no email to themselves
        }

        EmailService::notifyStaffOfChange($before, $after);
    }

    private function log(string $action, int $entityId, array $details): void
    {
        try {
            $this->auditModel->log(Auth::userId(), $action, 'reservations', $entityId, json_encode($details), Auth::clientIp());
        } catch (Exception $e) {
            error_log('Failed to insert activity log: ' . $e->getMessage());
        }
    }
}
