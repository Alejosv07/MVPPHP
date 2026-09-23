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

        if ($month && $year) {
            Response::json($this->model->getByMonthAndYear($month, $year, $staffId));
        } else {
            Response::json($this->model->getAll($staffId));
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

            $stmtSetting = $db->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'blocked_specific_dates' LIMIT 1");
            $stmtSetting->execute();
            $settingRow = $stmtSetting->fetch(PDO::FETCH_ASSOC);

            if ($settingRow && !empty($settingRow['setting_value'])) {
                $blockedSpecificDates = json_decode($settingRow['setting_value'], true);
                if (is_array($blockedSpecificDates) && in_array($data['service_date'], $blockedSpecificDates)) {
                    Response::json(['message' => 'The business is closed on this specific date due to administrator restrictions.'], 403);
                    return;
                }
            }

            $stmtDay = $db->prepare("SELECT setting_value FROM system_settings WHERE setting_key = 'global_blocked_days' LIMIT 1");
            $stmtDay->execute();
            $dayRow = $stmtDay->fetch(PDO::FETCH_ASSOC);

            if ($dayRow && !empty($dayRow['setting_value'])) {
                $globalBlockedDays = json_decode($dayRow['setting_value'], true);
                $dayOfWeek = (int)date('w', strtotime($data['service_date']));
                $normalizedGlobalDays = array_map('intval', is_array($globalBlockedDays) ? $globalBlockedDays : []);
                if (in_array($dayOfWeek, $normalizedGlobalDays)) {
                    Response::json(['message' => 'Bookings are globally disabled for this day of the week.'], 403);
                    return;
                }
            }

            $stmtTime = $db->query("SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('global_block_time_start', 'global_block_time_end')");
            $timeRows = $stmtTime->fetchAll(PDO::FETCH_KEY_PAIR);
            $globalStart = $timeRows['global_block_time_start'] ?? null;
            $globalEnd = $timeRows['global_block_time_end'] ?? null;

            if (!empty($globalStart) && !empty($globalEnd) && !empty($data['preferred_time'])) {
                $selectedMinutes = strtotime($data['preferred_time']) - strtotime('TODAY');
                $startMinutes = strtotime($globalStart) - strtotime('TODAY');
                $endMinutes = strtotime($globalEnd) - strtotime('TODAY');

                if ($selectedMinutes >= $startMinutes && $selectedMinutes <= $endMinutes) {
                    Response::json(['message' => "Bookings are globally blocked between {$globalStart} and {$globalEnd}."], 403);
                    return;
                }
            }

            $stmt = $db->prepare("SELECT id FROM reservations WHERE service_date = :date AND preferred_time = :time AND status != 'CANCELLED' LIMIT 1");
            $stmt->execute([
                ':date' => $data['service_date'],
                ':time' => $data['preferred_time']
            ]);

            if ($stmt->fetch()) {
                Response::json(['message' => 'This date and time slot is already booked. Please choose another time.'], 409);
                return;
            }

            $data['status'] = $data['status'] ?? 'PENDING';

            $id = $this->model->createWithCustomer($data);

            if ($id) {
                $this->logActivity(
                    userId: $data['user_id'] ?? null,
                    action: 'CREATE',
                    entityType: 'reservations',
                    entityId: (int)$id,
                    details: [
                        'customer' => $data['first_name'] . ' ' . $data['last_name'],
                        'email' => $data['email'],
                        'service_id' => $data['service_id'],
                        'status' => $data['status']
                    ]
                );

                $reservation = $this->model->getById($id);
                if ($reservation) {
                    EmailService::sendStatusUpdateEmail($reservation, 'PENDING');
                }
            }

            Response::json(['message' => 'Reservation created successfully', 'id' => $id], 201);
        } catch (Exception $e) {
            header('Content-Type: application/json; charset=UTF-8');
            http_response_code(500);
            echo json_encode([
                'message' => 'Error saving reservation',
                'error_detail' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ]);
            exit;
        }
    }

    private function update(int $id, array $data = []): void
    {
        $payload = json_decode(file_get_contents('php://input'), true);

        // Si solo se está actualizando el estado o se envía un precio junto con el estado actual
        if (isset($payload['status']) && !isset($payload['first_name'])) {
            $this->updateStatusOnly($id, $payload);
            return;
        }

        $required = ['first_name', 'last_name', 'email', 'phone_number', 'service_id', 'service_date', 'preferred_time', 'service_address'];
        foreach ($required as $field) {
            if (empty($payload[$field])) {
                Response::json(['message' => "The field {$field} is required"], 422);
                return;
            }
        }

        try {
            $success = $this->model->update($id, $payload);

            if ($success) {
                $this->logActivity(
                    userId: $payload['user_id'] ?? null,
                    action: 'UPDATE',
                    entityType: 'reservations',
                    entityId: $id,
                    details: $payload
                );

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
                $this->logActivity(
                    userId: $userId,
                    action: 'UPDATE',
                    entityType: 'reservations',
                    entityId: $id,
                    details: [
                        'mutation_type' => 'STATUS_CHANGE_WITH_DETAILS',
                        'new_status' => $data['status'],
                        'staff_id' => $staffId,
                        'comment' => $comment
                    ]
                );

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

        $secret = 'purenest_secret';
        $expectedToken = hash('sha256', $id . 'balrking07@gmail.com' . $secret);

        if ($token !== $expectedToken || !in_array($action, ['confirm', 'cancel'], true)) {
            die("<h2 style='color:red; text-align:center; margin-top:50px;'>Invalid or expired action link.</h2>");
        }

        $newStatus = ($action === 'confirm') ? 'CONFIRMED' : 'CANCELLED';
        $success = $this->model->updateStatus($id, $newStatus, null, "Updated to {$newStatus} via email click");

        if ($success) {
            $this->logActivity(
                userId: null,
                action: 'UPDATE',
                entityType: 'reservations',
                entityId: $id,
                details: ['method' => 'EMAIL_ACTION_LINK', 'new_status' => $newStatus]
            );

            $reservation = $this->model->getById($id);
            if ($reservation) {
                EmailService::sendStatusUpdateEmail($reservation, $newStatus);
            }

            header("Content-Type: text/html; charset=UTF-8");
            echo "
            <div style='font-family: Arial, sans-serif; text-align: center; padding: 60px 20px; background-color: #f8f9fa;'>
                <div style='max-width: 500px; margin: 0 auto; background: #ffffff; padding: 40px; border-radius: 12px; border: 1px solid #e5e7eb;'>
                    <h1 style='color: #1b3022;'>Luxuria Pure</h1>
                    <h2 style='color: " . ($newStatus === 'CONFIRMED' ? '#15803d' : '#b91c1c') . ";'>
                        Reservation " . ($newStatus === 'CONFIRMED' ? 'Confirmed' : 'Cancelled') . "!
                    </h2>
                    <p style='color: #4b5563;'>Your reservation <strong>#RES-" . str_pad((string)$id, 4, '0', STR_PAD_LEFT) . "</strong> status is now <strong>{$newStatus}</strong>.</p>
                </div>
            </div>";
        } else {
            echo "<h2 style='color:red; text-align:center; margin-top:50px;'>Failed to update reservation.</h2>";
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
