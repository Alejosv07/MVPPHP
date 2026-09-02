<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Config\Database;
use App\Utils\Response;
use App\Utils\EmailService;
use PDO;

class PublicReservationController {

    public function handleAction(): void {
        $id = $_GET['id'] ?? null;
        $token = $_GET['token'] ?? null;
        $action = $_GET['action'] ?? null;

        if (!$id || !$token || !in_array($action, ['confirm', 'cancel'], true)) {
            Response::json(['message' => 'Invalid parameters'], 400);
            return;
        }

        $db = (new Database())->getConnection();
        
        $stmt = $db->prepare("SELECT r.*, c.email, c.first_name, c.last_name, s.name as service_name FROM reservations r JOIN customers c ON r.customer_id = c.id JOIN services s ON r.service_id = s.id WHERE r.id = :id AND SHA2(CONCAT(r.id, c.email, 'purenest_secret'), 256) = :token LIMIT 1");
        $stmt->execute([':id' => $id, ':token' => $token]);
        $reservation = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$reservation) {
            Response::json(['message' => 'Reservation not found or invalid token'], 404);
            return;
        }

        $newStatus = ($action === 'confirm') ? 'CONFIRMED' : 'CANCELLED';

        $updateStmt = $db->prepare("UPDATE reservations SET status = :status WHERE id = :id");
        $updateStmt->execute([':status' => $newStatus, ':id' => $id]);

        $historyStmt = $db->prepare("INSERT INTO reservation_history (reservation_id, user_id, previous_status, new_status, comment) VALUES (:id, NULL, :prev, :new, :comment)");
        $historyStmt->execute([
            ':id' => $id,
            ':prev' => $reservation['status'],
            ':new' => $newStatus,
            ':comment' => "Status updated to {$newStatus} by customer via email link."
        ]);

        EmailService::sendStatusUpdateEmail($reservation, $newStatus);

        echo "<div style='text-align:center; padding:50px; font-family:sans-serif;'>
                <h2>Reservation Updated!</h2>
                <p>Your reservation #RES-" . str_pad((string)$id, 4, '0', STR_PAD_LEFT) . " status is now <strong>{$newStatus}</strong>.</p>
              </div>";
    }
}