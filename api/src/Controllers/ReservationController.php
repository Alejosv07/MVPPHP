<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Models\AuditModel;
use App\Models\ReservationModel;
use App\Utils\Auth;
use App\Utils\EmailService;
use App\Utils\RateLimiter;
use App\Utils\Response;
use Exception;

/**
 * Access rules (router + this class):
 *  - POST without token: public booking request (forced to PENDING, no price, no staff)
 *  - Everything else: ADMIN, or STAFF limited to their own assignments
 */
class ReservationController
{
    private const STATUSES = ['PENDING', 'CONFIRMED', 'INITIATED', 'ON_THE_WAY', 'RESCHEDULED', 'COMPLETED', 'CANCELLED', 'REJECTED'];
    private const STAFF_STATUSES = ['INITIATED', 'ON_THE_WAY', 'COMPLETED'];
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
        if (Auth::isStaff() && (int)($reservation['staff_id'] ?? 0) !== Auth::userId()) {
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

        if ($month && $year) {
            Response::json($this->model->getByMonthAndYear($month, $year, $staffId, $search));
        }
        Response::json($this->model->getAll($staffId, $search));
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

        $data['email'] = strtolower(trim((string)$data['email']));
        $data['bedrooms'] = max(0, min(20, (float)($data['bedrooms'] ?? 1)));
        $data['bathrooms'] = max(0, min(20, (float)($data['bathrooms'] ?? 1)));
        if (!in_array($data['frequency'] ?? 'One-time', self::FREQUENCIES, true)) {
            $data['frequency'] = 'One-time';
        }
        if (!in_array($data['status'] ?? 'PENDING', self::STATUSES, true)) {
            $data['status'] = 'PENDING';
        }
        $data['user_id'] = Auth::userId();

        try {
            $id = $this->model->createWithCustomer($data);
            if (!$isStaffUser) {
                $this->model->recordConsent($id, !empty($data['sms_consent']), Auth::clientIp());
            }
            $reservation = $this->model->getById($id);
            if ($reservation) {
                // Website requests are always PENDING; admin-created bookings get the email of the status chosen
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

        if ($error = $this->validateBooking($payload)) {
            Response::json(['message' => $error], 422);
        }

        try {
            if ($this->model->update($id, $payload)) {
                $this->log('UPDATE', $id, ['method' => 'ADMIN_EDIT']);
                Response::json(['message' => 'Reservation updated successfully']);
            }
            Response::json(['message' => 'Reservation not found or no changes made'], 404);
        } catch (Exception $e) {
            error_log('Reservation update failed: ' . $e->getMessage());
            Response::json(['message' => 'Error updating reservation'], 500);
        }
    }

    private function updateStatusOnly(int $id, array $data, array $current): void
    {
        $status = strtoupper(trim((string)($data['status'] ?? '')));

        if (!in_array($status, self::STATUSES, true)) {
            Response::json(['message' => 'Invalid status'], 422);
        }

        $isStaff = Auth::isStaff();
        if ($isStaff && !in_array($status, self::STAFF_STATUSES, true)) {
            Response::json(['message' => 'Staff can only mark a job as On the way, Initiated or Completed'], 403);
        }

        $comment = mb_substr((string)($data['comment'] ?? 'Status updated via admin panel'), 0, 500);

        // Staff cannot change price, date, time or assignment
        $totalPrice = (!$isStaff && isset($data['total_price'])) ? (float)$data['total_price'] : null;
        $serviceDate = (!$isStaff && !empty($data['service_date'])) ? (string)$data['service_date'] : null;
        $preferredTime = (!$isStaff && !empty($data['preferred_time'])) ? (string)$data['preferred_time'] : null;
        $staffId = (!$isStaff && isset($data['staff_id']) && $data['staff_id'] !== '') ? (int)$data['staff_id'] : null;

        if ($serviceDate !== null && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $serviceDate)) {
            Response::json(['message' => 'Invalid service date'], 422);
        }
        if ($preferredTime !== null && !preg_match('/^\d{1,2}:\d{2}(:\d{2})?$/', $preferredTime)) {
            Response::json(['message' => 'Invalid preferred time'], 422);
        }
        if ($totalPrice !== null && ($totalPrice < 0 || $totalPrice > 100000)) {
            Response::json(['message' => 'Invalid price'], 422);
        }

        try {
            $success = $this->model->updateStatusWithDetails($id, $status, Auth::userId(), $comment, $totalPrice, $serviceDate, $preferredTime, $staffId);

            if ($success) {
                $this->log('UPDATE', $id, ['previous_status' => $current['status'], 'new_status' => $status]);

                $this->notifyChanges($id, $current, $status, $totalPrice, $serviceDate, $preferredTime, $staffId);
                Response::json(['message' => 'Reservation updated successfully']);
            }
            Response::json(['message' => 'Reservation not found'], 404);
        } catch (Exception $e) {
            error_log('Reservation status update failed: ' . $e->getMessage());
            Response::json(['message' => 'Error updating status'], 500);
        }
    }

    /**
     * Emails only what changed, to the right person:
     *  - customer: new status, or new price/date/time on the same status ("updated details")
     *  - assigned cleaner: job assigned to them, job moved, job cancelled/rejected
     */
    private function notifyChanges(int $id, array $current, string $status, ?float $totalPrice, ?string $serviceDate, ?string $preferredTime, ?int $staffId): void
    {
        $statusChanged = $status !== $current['status'];
        $priceChanged = $totalPrice !== null && (float)$current['total_price'] !== $totalPrice;
        $dateChanged = ($serviceDate !== null && $serviceDate !== $current['service_date'])
            || ($preferredTime !== null && substr($preferredTime, 0, 5) !== substr((string)$current['preferred_time'], 0, 5));
        $staffChanged = $staffId !== null && $staffId !== (int)($current['staff_id'] ?? 0);

        if (!$statusChanged && !$priceChanged && !$dateChanged && !$staffChanged) {
            return;
        }

        $reservation = $this->model->getById($id);
        if (!$reservation) {
            return;
        }

        if ($statusChanged || $priceChanged || $dateChanged) {
            EmailService::sendStatusUpdateEmail($reservation, $status, ['updated' => !$statusChanged]);
        }

        // Staff moving their own job (On the way / Started / Completed) needs no email to themselves
        if (Auth::isStaff() || empty($reservation['staff_email'])) {
            return;
        }
        if (in_array($status, ['CANCELLED', 'REJECTED'], true)) {
            if ($statusChanged && !$staffChanged) {
                EmailService::sendStaffJobEmail($reservation, 'cancelled');
            }
        } elseif ($staffChanged) {
            EmailService::sendStaffJobEmail($reservation, 'assigned');
        } elseif ($dateChanged) {
            EmailService::sendStaffJobEmail($reservation, 'rescheduled');
        }
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
