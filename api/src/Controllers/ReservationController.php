<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Models\ReservationModel;
use App\Models\AuditModel;
use App\Utils\Response;
use App\Utils\EmailService;
use App\Config\Database;
use Exception;
use PDO;

class ReservationController
{
    private ReservationModel $model;
    private AuditModel $auditModel;

    public function __construct()
    {
        $this->model = new ReservationModel();
        $this->auditModel = new AuditModel();
    }

    public function handle(string $method, ?int $id, ?string $subResource): void
    {
        if (!$id && isset($_GET['id'])) {
            $id = (int)$_GET['id'];
        }

        if ($subResource === 'history' && $id) {
            Response::json($this->model->getHistory($id));
            return;
        }

        if ($method === 'GET' && isset($_GET['action'])) {
            $this->handleEmailAction();
            return;
        }

        match ($method) {
            'GET'    => $id ? $this->getOne($id) : $this->getAllFiltered(),
            'POST'   => $this->create(),
            'PUT'    => $id ? $this->update($id) : Response::json(['message' => 'ID is required'], 400),
            default  => Response::json(['message' => 'Method not allowed'], 405)
        };
    }

    private function getAllFiltered(): void
    {
        $month = isset($_GET['month']) ? (int)$_GET['month'] : null;
        $year = isset($_GET['year']) ? (int)$_GET['year'] : null;
        $staffId = isset($_GET['staff_id']) ? (int)$_GET['staff_id'] : null;
        $search = isset($_GET['search']) ? trim($_GET['search']) : null;

        if ($month && $year) {
            Response::json($this->model->getByMonthAndYear($month, $year, $staffId, $search));
        } else {
            Response::json($this->model->getAll($staffId, $search));
        }
    }

    private function getOne(int $id): void
    {
        $reservation = $this->model->getById($id);
        if ($reservation) {
            Response::json($reservation);
        } else {
            Response::json(['message' => 'Reservation not found'], 404);
        }
    }

    private function create(): void
    {
        $data = json_decode(file_get_contents('php://input'), true);

        $required = ['first_name', 'last_name', 'email', 'phone_number', 'service_id', 'service_date', 'preferred_time', 'service_address'];
        foreach ($required as $field) {
            if (empty($data[$field])) {
                Response::json(['message' => "The field {$field} is required"], 422);
                return;
            }
        }

        try {
            $db = (new Database())->getConnection();

            $id = $this->model->createWithCustomer($data);

            if ($id) {
                $reservation = $this->model->getById($id);
                if ($reservation) {
                    EmailService::sendStatusUpdateEmail($reservation, 'PENDING');
                }
            }

            Response::json(['message' => 'Reservation created successfully', 'id' => $id], 201);
        } catch (Exception $e) {
            Response::json(['message' => 'Error saving reservation', 'error_detail' => $e->getMessage()], 500);
        }
    }

    private function update(int $id, array $data = []): void
    {
        $payload = json_decode(file_get_contents('php://input'), true);

        if (isset($payload['status']) && !isset($payload['first_name'])) {
            $this->updateStatusOnly($id, $payload);
            return;
        }

        try {
            $success = $this->model->update($id, $payload);
            if ($success) {
                Response::json(['message' => 'Reservation updated successfully']);
            } else {
                Response::json(['message' => 'Reservation not found or no changes made'], 404);
            }
        } catch (Exception $e) {
            Response::json(['message' => 'Error updating reservation', 'detail' => $e->getMessage()], 500);
        }
    }

    private function updateStatusOnly(int $id, array $data): void
    {
        if (empty($data['status'])) {
            Response::json(['message' => 'New status is required'], 422);
            return;
        }

        try {
            $userId = $data['user_id'] ?? null;
            $comment = $data['comment'] ?? "Status updated via admin panel";
            $totalPrice = isset($data['total_price']) ? (float)$data['total_price'] : null;
            $serviceDate = $data['service_date'] ?? null;
            $preferredTime = $data['preferred_time'] ?? null;
            $staffId = isset($data['staff_id']) ? ($data['staff_id'] !== '' ? (int)$data['staff_id'] : null) : null;

            $success = $this->model->updateStatusWithDetails($id, $data['status'], $userId, $comment, $totalPrice, $serviceDate, $preferredTime, $staffId);

            if ($success) {
                $reservation = $this->model->getById($id);
                if ($reservation) {
                    EmailService::sendStatusUpdateEmail($reservation, $data['status']);
                }
                Response::json(['message' => 'Reservation updated successfully']);
            } else {
                Response::json(['message' => 'Reservation not found'], 404);
            }
        } catch (Exception $e) {
            Response::json(['message' => 'Error updating status', 'detail' => $e->getMessage()], 500);
        }
    }

    private function handleEmailAction(): void
    {
        $id = (int)($_GET['id'] ?? 0);
        $action = $_GET['action'] ?? '';
        $token = $_GET['token'] ?? '';

        $reservation = $this->model->getById($id);
        if (!$reservation) {
            die("<h2 style='color:red; text-align:center; margin-top:50px;'>Reservation not found.</h2>");
        }

        $customerEmail = !empty($reservation['email']) ? $reservation['email'] : 'balrking07@gmail.com';
        $secret = 'purenest_secret';
        $expectedToken = hash('sha256', $id . $customerEmail . $secret);

        if ($token !== $expectedToken || !in_array($action, ['confirm', 'cancel', 'reschedule', 'feedback'], true)) {
            die("<h2 style='color:red; text-align:center; margin-top:50px;'>Invalid or expired link.</h2>");
        }

        if ($action === 'feedback' && $_SERVER['REQUEST_METHOD'] === 'POST') {
            $rating = (int)($_POST['rating'] ?? 5);
            $comment = trim($_POST['comment'] ?? '');

            $db = (new Database())->getConnection();
            $updateStmt = $db->prepare("UPDATE reservations SET rating = :rating, feedback_comment = :comment WHERE id = :id");
            $updateStmt->execute([':rating' => $rating, ':comment' => $comment, ':id' => $id]);

            echo "
            <div style='font-family: Arial, sans-serif; text-align: center; padding: 60px 20px; background-color: #f8f9fa;'>
                <div style='max-width: 500px; margin: 0 auto; background: #ffffff; padding: 40px; border-radius: 12px; border: 1px solid #e5e7eb;'>
                    <h1 style='color: #0f172a;'>Luxuria Pure</h1>
                    <h2 style='color: #059669;'>Thank You for Your Feedback!</h2>
                    <p style='color: #4b5563;'>We have saved your rating for reservation <strong>#RES-" . str_pad((string)$id, 4, '0', STR_PAD_LEFT) . "</strong>.</p>
                </div>
            </div>";
            return;
        }

        if ($action === 'feedback') {
            header("Content-Type: text/html; charset=UTF-8");
            echo "
            <div style='font-family: Arial, sans-serif; background-color: #f8f9fa; padding: 60px 20px; text-align: center;'>
                <div style='max-width: 450px; margin: 0 auto; background: #ffffff; padding: 40px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05);'>
                    <h1 style='color: #0f172a; font-size: 24px; margin-bottom: 10px;'>Luxuria Pure</h1>
                    <h3 style='color: #475569; margin-bottom: 25px;'>Rate Our Service</h3>
                    <p style='color: #64748b; font-size: 14px; margin-bottom: 20px;'>Reservation: <strong>#RES-" . str_pad((string)$id, 4, '0', STR_PAD_LEFT) . "</strong></p>
                    
                    <form method='POST' action=''>
                        <div style='margin-bottom: 20px; text-align: left;'>
                            <label style='display: block; font-size: 12px; font-weight: bold; color: #475569; text-transform: uppercase; margin-bottom: 8px;'>Rating (1 to 5):</label>
                            <select name='rating' style='width: 100%; padding: 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 15px; box-sizing: border-box; outline: none; background: #fff;'>
                                <option value='5'>⭐⭐⭐⭐⭐ (5 - Excellent)</option>
                                <option value='4'>⭐⭐⭐⭐ (4 - Very Good)</option>
                                <option value='3'>⭐⭐⭐ (3 - Good)</option>
                                <option value='2'>⭐⭐ (2 - Fair)</option>
                                <option value='1'>⭐ (1 - Poor)</option>
                            </select>
                        </div>
                        <div style='margin-bottom: 20px; text-align: left;'>
                            <label style='display: block; font-size: 12px; font-weight: bold; color: #475569; text-transform: uppercase; margin-bottom: 8px;'>Comment:</label>
                            <textarea name='comment' rows='4' placeholder='Tell us about your experience...' style='width: 100%; padding: 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 15px; box-sizing: border-box; outline: none;'></textarea>
                        </div>
                        <button type='submit' style='width: 100%; background-color: #059669; color: #ffffff; padding: 14px; border: none; border-radius: 6px; font-weight: bold; font-size: 14px; cursor: pointer;'>
                            Submit Rating
                        </button>
                    </form>
                </div>
            </div>";
            return;
        }

        if ($action === 'reschedule' && $_SERVER['REQUEST_METHOD'] === 'POST') {
            $newDate = $_POST['service_date'] ?? '';
            $today = date('Y-m-d');

            if (empty($newDate) || $newDate < $today) {
                echo "<script>alert('Error: You cannot select a past date.'); window.history.back();</script>";
                return;
            }

            $success = $this->model->updateStatusWithDetails(
                $id,
                'RESCHEDULED',
                null,
                "Service date rescheduled to {$newDate} by customer via email link.",
                null,
                $newDate,
                null,
                null
            );

            if ($success) {
                $this->logActivity(
                    userId: null,
                    action: 'UPDATE',
                    entityType: 'reservations',
                    entityId: $id,
                    details: ['method' => 'EMAIL_RESCHEDULE', 'new_date' => $newDate]
                );

                $updatedReservation = $this->model->getById($id);
                if ($updatedReservation) {
                    EmailService::sendStatusUpdateEmail($updatedReservation, 'RESCHEDULED');
                }

                echo "
                <div style='font-family: Arial, sans-serif; text-align: center; padding: 60px 20px; background-color: #f8f9fa;'>
                    <div style='max-width: 500px; margin: 0 auto; background: #ffffff; padding: 40px; border-radius: 12px; border: 1px solid #e5e7eb;'>
                        <h1 style='color: #0f172a;'>Luxuria Pure</h1>
                        <h2 style='color: #9333ea;'>Date Rescheduled Successfully!</h2>
                        <p style='color: #4b5563;'>Your reservation <strong>#RES-" . str_pad((string)$id, 4, '0', STR_PAD_LEFT) . "</strong> has been updated to <strong>{$newDate}</strong>.</p>
                    </div>
                </div>";
                return;
            } else {
                echo "<h2 style='color:red; text-align:center; margin-top:50px;'>Could not update the date.</h2>";
                return;
            }
        }

        if ($action === 'reschedule') {
            $currentDate = $reservation['service_date'] ?? date('Y-m-d');
            $minDate = date('Y-m-d');

            header("Content-Type: text/html; charset=UTF-8");
            echo "
            <div style='font-family: Arial, sans-serif; background-color: #f8f9fa; padding: 60px 20px; text-align: center;'>
                <div style='max-width: 450px; margin: 0 auto; background: #ffffff; padding: 40px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05);'>
                    <h1 style='color: #0f172a; font-size: 24px; margin-bottom: 10px;'>Luxuria Pure</h1>
                    <h3 style='color: #475569; margin-bottom: 25px;'>Reschedule Service Date</h3>
                    <p style='color: #64748b; font-size: 14px; margin-bottom: 20px;'>Reservation: <strong>#RES-" . str_pad((string)$id, 4, '0', STR_PAD_LEFT) . "</strong></p>
                    
                    <form method='POST' action=''>
                        <div style='margin-bottom: 20px; text-align: left;'>
                            <label style='display: block; font-size: 12px; font-weight: bold; color: #475569; text-transform: uppercase; margin-bottom: 8px;'>Select New Date:</label>
                            <input type='date' name='service_date' value='{$currentDate}' min='{$minDate}' required 
                                style='width: 100%; padding: 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 15px; box-sizing: border-box; outline: none;'>
                        </div>
                        <button type='submit' style='width: 100%; background-color: #0f172a; color: #ffffff; padding: 14px; border: none; border-radius: 6px; font-weight: bold; font-size: 14px; cursor: pointer;'>
                            Save New Date
                        </button>
                    </form>
                </div>
            </div>";
            return;
        }

        $newStatus = ($action === 'confirm') ? 'CONFIRMED' : 'CANCELLED';
        $success = $this->model->updateStatus($id, $newStatus, null, "Status updated to {$newStatus} via email link");

        if ($success) {
            $this->logActivity(
                userId: null,
                action: 'UPDATE',
                entityType: 'reservations',
                entityId: $id,
                details: ['method' => 'EMAIL_ACTION_LINK', 'new_status' => $newStatus]
            );

            $updatedReservation = $this->model->getById($id);
            if ($updatedReservation) {
                EmailService::sendStatusUpdateEmail($updatedReservation, $newStatus);
            }

            header("Content-Type: text/html; charset=UTF-8");
            echo "
            <div style='font-family: Arial, sans-serif; text-align: center; padding: 60px 20px; background-color: #f8f9fa;'>
                <div style='max-width: 500px; margin: 0 auto; background: #ffffff; padding: 40px; border-radius: 12px; border: 1px solid #e5e7eb;'>
                    <h1 style='color: #0f172a;'>Luxuria Pure</h1>
                    <h2 style='color: " . ($newStatus === 'CONFIRMED' ? '#15803d' : '#b91c1c') . ";'>
                        Reservation " . ($newStatus === 'CONFIRMED' ? 'Confirmed' : 'Cancelled') . "!
                    </h2>
                    <p style='color: #4b5563;'>Your reservation <strong>#RES-" . str_pad((string)$id, 4, '0', STR_PAD_LEFT) . "</strong> status is now <strong>{$newStatus}</strong>.</p>
                </div>
            </div>";
        } else {
            echo "<h2 style='color:red; text-align:center; margin-top:50px;'>Error updating reservation.</h2>";
        }
    }

    private function logActivity(?int $userId, string $action, string $entityType, int $entityId, array $details): void
    {
        $ipAddress = $_SERVER['HTTP_CLIENT_IP']
            ?? $_SERVER['HTTP_X_FORWARDED_FOR']
             ?? $_SERVER['REMOTE_ADDR']
             ?? '127.0.0.1';

        if (str_contains($ipAddress, ',')) {
            $ipAddress = trim(explode(',', $ipAddress)[0]);
        }

        if ($ipAddress === '::1') {
            $ipAddress = '127.0.0.1';
        }

        try {
            if (method_exists($this->auditModel, 'log')) {
                $this->auditModel->log($userId, $action, $entityType, $entityId, json_encode($details), $ipAddress);
            }
        } catch (Exception $e) {
            error_log("Failed to insert activity log: " . $e->getMessage());
        }
    }
}