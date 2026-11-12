<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Config\Database;
use App\Models\CustomerAuthModel;
use App\Utils\Auth;
use App\Utils\EmailService;
use App\Utils\RateLimiter;
use App\Utils\Response;
use PDO;

class CustomerAuthController
{
    private CustomerAuthModel $model;

    public function __construct()
    {
        $this->model = new CustomerAuthModel();
    }

    private function input(): array
    {
        $data = json_decode(file_get_contents('php://input'), true);
        return is_array($data) ? $data : [];
    }

    public function sendOtp(): void
    {
        $data = $this->input();
        $email = strtolower(trim((string)($data['email'] ?? '')));

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Response::json(['message' => 'A valid email is required'], 422);
        }

        RateLimiter::hit('otp-send-ip', Auth::clientIp(), 15, 3600);
        RateLimiter::hit('otp-send-email', $email, 3, 900);

        $generic = ['message' => 'If the email has bookings with us, a security PIN has been sent.'];

        if (!$this->model->customerExists($email)) {
            Response::json($generic);
        }

        $code = (string)random_int(100000, 999999);

        if ($this->model->saveOtpCode($email, $code)) {
            EmailService::sendOtpEmail($email, $code);
        }

        Response::json($generic);
    }

    public function verifyOtp(): void
    {
        $data = $this->input();
        $email = strtolower(trim((string)($data['email'] ?? '')));
        $code = trim((string)($data['code'] ?? ''));

        if ($email === '' || !preg_match('/^\d{6}$/', $code)) {
            Response::json(['message' => 'Email and 6-digit PIN are required'], 422);
        }

        RateLimiter::hit('otp-verify-ip', Auth::clientIp(), 30, 3600);
        RateLimiter::hit('otp-verify-email', $email, 5, 900);

        $result = $this->model->verifyOtpAndGetReservations($email, $code);

        if ($result === null) {
            Response::json(['message' => 'Invalid or expired verification PIN'], 400);
        }

        RateLimiter::clear('otp-verify-email', $email);

        $token = Auth::issue([
            'scope' => 'customer',
            'cids'  => $result['customer_ids'],
        ], 1800);

        Response::json([
            'message'        => 'Verification successful',
            'customer_token' => $token,
            'reservations'   => $result['reservations'],
        ]);
    }

    /** Customer rates a completed service (requires the OTP customer token). */
    public function submitCustomerRating(int $reservationId): void
    {
        $customerIds = Auth::requireCustomer();
        $data = $this->input();
        $rating = (int)($data['customer_rating'] ?? 0);
        $notes = mb_substr(trim((string)($data['customer_notes'] ?? '')), 0, 1000);

        if ($rating < 1 || $rating > 5) {
            Response::json(['message' => 'Rating must be between 1 and 5'], 422);
        }

        $db = (new Database())->getConnection();
        $stmt = $db->prepare('SELECT customer_id, status FROM reservations WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $reservationId]);
        $reservation = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$reservation || !in_array((int)$reservation['customer_id'], $customerIds, true)) {
            Response::json(['message' => 'Reservation not found'], 404);
        }
        if ($reservation['status'] !== 'COMPLETED') {
            Response::json(['message' => 'Only completed services can be rated'], 422);
        }

        $stmt = $db->prepare('
            INSERT INTO reservation_ratings (reservation_id, customer_rating, customer_notes)
            VALUES (:reservation_id, :rating, :notes)
            ON DUPLICATE KEY UPDATE customer_rating = VALUES(customer_rating), customer_notes = VALUES(customer_notes)
        ');
        $stmt->execute([':reservation_id' => $reservationId, ':rating' => $rating, ':notes' => $notes ?: null]);

        $full = (new \App\Models\ReservationModel())->getById($reservationId);
        if ($full) {
            $ref = sprintf('#RES-%04d', $reservationId);
            $note = str_repeat('★', $rating) . str_repeat('☆', 5 - $rating) . " ({$rating}/5)"
                . ($notes !== '' ? '<br>"' . htmlspecialchars($notes, ENT_QUOTES, 'UTF-8') . '"' : '');
            EmailService::sendTeamAlert($full, "New {$rating}-star rating for {$ref}", $note);
        }

        Response::json(['message' => 'Customer rating saved successfully']);
    }

    /** Staff/admin internal rating of a reservation. */
    public function submitStaffRating(int $reservationId): void
    {
        $data = $this->input();
        $rating = (int)($data['staff_rating'] ?? 0);

        if ($reservationId <= 0 || $rating < 1 || $rating > 5) {
            Response::json(['message' => 'Invalid staff rating data'], 422);
        }

        $db = (new Database())->getConnection();

        if (Auth::isStaff()) {
            $stmt = $db->prepare('SELECT staff_id FROM reservations WHERE id = :id');
            $stmt->execute([':id' => $reservationId]);
            if ((int)$stmt->fetchColumn() !== Auth::userId()) {
                Response::json(['message' => 'You can only rate your own assignments'], 403);
            }
        }

        $stmt = $db->prepare('
            INSERT INTO reservation_ratings (reservation_id, staff_rating, staff_notes)
            VALUES (:reservation_id, :staff_rating, :staff_notes)
            ON DUPLICATE KEY UPDATE staff_rating = VALUES(staff_rating), staff_notes = VALUES(staff_notes)
        ');
        $stmt->execute([
            ':reservation_id' => $reservationId,
            ':staff_rating'   => $rating,
            ':staff_notes'    => isset($data['staff_notes']) ? mb_substr((string)$data['staff_notes'], 0, 2000) : null,
        ]);

        Response::json(['message' => 'Staff rating saved successfully']);
    }
}
