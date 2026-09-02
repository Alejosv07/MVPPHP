<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Models\ReservationModel;
use App\Utils\Response;
use App\Utils\EmailService;
use App\Config\Database;
use Exception;

class ReservationController
{
    private ReservationModel $model;

    public function __construct()
    {
        $this->model = new ReservationModel();
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
            'GET'    => $id ? $this->getOne($id) : Response::json($this->model->getAll()),
            'POST'   => $this->create(),
            'PUT'    => $id ? $this->update($id) : Response::json(['message' => 'ID is required'], 400),
            default  => Response::json(['message' => 'Method not allowed'], 405)
        };
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
            $stmt = $db->prepare("SELECT id FROM reservations WHERE service_date = :date AND preferred_time = :time AND status != 'CANCELLED' LIMIT 1");
            $stmt->execute([
                ':date' => $data['service_date'],
                ':time' => $data['preferred_time']
            ]);

            if ($stmt->fetch()) {
                Response::json(['message' => 'This date and time slot is already booked. Please choose another time.'], 409);
                return;
            }

            // Asegurar que por defecto se cree en PENDING
            $data['status'] = $data['status'] ?? 'PENDING';

            $id = $this->model->createWithCustomer($data);

            // Enviar correo electrónico con estado PENDING al crear la reservación
            if ($id) {
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

    private function update(int $id): void
    {
        $data = json_decode(file_get_contents('php://input'), true);

        if (isset($data['status']) && count($data) <= 2) {
            $this->updateStatusOnly($id, $data);
            return;
        }

        $required = ['first_name', 'last_name', 'email', 'phone_number', 'service_id', 'service_date', 'preferred_time', 'service_address'];
        foreach ($required as $field) {
            if (empty($data[$field])) {
                Response::json(['message' => "The field {$field} is required"], 422);
                return;
            }
        }

        try {
            $success = $this->model->update($id, $data);

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
            $success = $this->model->updateStatus(
                $id,
                $data['status'],
                $data['user_id'] ?? null,
                $data['comment'] ?? null
            );

            if ($success) {
                $reservation = $this->model->getById($id);
                if ($reservation) {
                    EmailService::sendStatusUpdateEmail($reservation, $data['status']);
                }
                Response::json(['message' => 'Reservation status updated successfully']);
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
            $reservation = $this->model->getById($id);
            if ($reservation) {
                EmailService::sendStatusUpdateEmail($reservation, $newStatus);
            }

            header("Content-Type: text/html; charset=UTF-8");
            echo "
            <div style='font-family: Arial, sans-serif; text-align: center; padding: 60px 20px; background-color: #f8f9fa;'>
                <div style='max-width: 500px; margin: 0 auto; background: #ffffff; padding: 40px; border-radius: 12px; border: 1px solid #e5e7eb;'>
                    <h1 style='color: #1b3022;'>PureNest Cleaning</h1>
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
}