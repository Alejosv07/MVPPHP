<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Models\CustomerAuthModel;
use App\Models\AuthModel;
use App\Utils\Response;
use App\Utils\EmailService;
use App\Config\Database;
use PDO;

class CustomerAuthController
{
    private CustomerAuthModel $model;

    public function __construct()
    {
        $this->model = new CustomerAuthModel();
    }

    public function sendOtp(): void
    {
        $data = json_decode(file_get_contents('php://input'), true);

        if (empty($data['email'])) {
            Response::json(['message' => 'Email is required'], 422);
            return;
        }

        $email = trim($data['email']);

        $db = (new Database())->getConnection();
        $stmt = $db->prepare("SELECT id FROM customers WHERE email = :email LIMIT 1");
        $stmt->execute([':email' => $email]);
        $customer = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$customer) {
            Response::json(['message' => 'If the email exists, a security PIN has been sent.']);
            return;
        }

        $code = str_pad((string)random_int(0, 9999), 4, '0', STR_PAD_LEFT);

        if ($this->model->saveOtpCode($email, $code)) {
            try {
                \App\Utils\EmailService::sendOtpEmail($email, $code);
            } catch (\Exception $e) {
            }

            Response::json(['message' => 'Security PIN sent successfully']);
            return;
        }

        Response::json(['message' => 'Could not generate verification PIN'], 500);
    }

    public function verifyOtp(): void
    {
        $data = json_decode(file_get_contents('php://input'), true);

        if (empty($data['email']) || empty($data['code'])) {
            Response::json(['message' => 'Email and PIN code are required'], 422);
            return;
        }

        try {
            $reservations = $this->model->verifyOtpAndGetReservations(trim($data['email']), trim($data['code']));

            if ($reservations !== null) {
                Response::json([
                    'message' => 'Verification successful',
                    'reservations' => $reservations
                ]);
                return;
            }

            Response::json(['message' => 'Invalid or expired verification PIN'], 400);
        } catch (\Exception $e) {
            Response::json(['message' => 'Server Error: ' . $e->getMessage()], 500);
        }
    }
    public function submitStaffRating(?int $reservationId = null): void
    {
        $reservationId = $reservationId ?? (int)($_GET['id'] ?? 0);
        $data = json_decode(file_get_contents('php://input'), true);

        if ($reservationId <= 0 || empty($data['staff_rating'])) {
            Response::json(['message' => 'Invalid staff rating data'], 422);
            return;
        }

        $db = (new Database())->getConnection();

        $stmt = $db->prepare("
            INSERT INTO reservation_ratings (reservation_id, staff_rating, staff_notes) 
            VALUES (:reservation_id, :staff_rating, :staff_notes) 
            ON DUPLICATE KEY UPDATE staff_rating = VALUES(staff_rating), staff_notes = VALUES(staff_notes)
        ");

        $stmt->execute([
            ':reservation_id' => $reservationId,
            ':staff_rating' => (int)$data['staff_rating'],
            ':staff_notes' => $data['staff_notes'] ?? null
        ]);

        Response::json(['message' => 'Staff rating saved successfully']);
    }
    public function submitCustomerRating(?int $reservationId = null): void
    {
        $reservationId = $reservationId ?? (int)($_GET['id'] ?? 0);
        $data = json_decode(file_get_contents('php://input'), true);

        if ($reservationId <= 0 || empty($data['customer_rating'])) {
            Response::json(['message' => 'Invalid rating data'], 422);
            return;
        }

        $db = (new Database())->getConnection();

        $stmt = $db->prepare("
            INSERT INTO reservation_ratings (reservation_id, customer_rating, customer_notes) 
            VALUES (:reservation_id, :customer_rating, :customer_notes) 
            ON DUPLICATE KEY UPDATE customer_rating = VALUES(customer_rating), customer_notes = VALUES(customer_notes)
        ");

        $stmt->execute([
            ':reservation_id' => $reservationId,
            ':customer_rating' => (int)$data['customer_rating'],
            ':customer_notes' => $data['customer_notes'] ?? null
        ]);

        Response::json(['message' => 'Customer rating saved successfully']);
    }
}
