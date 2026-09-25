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

        if (!$id || !$token || !in_array($action, ['confirm', 'cancel', 'reschedule', 'feedback'], true)) {
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

        if ($action === 'feedback' && $_SERVER['REQUEST_METHOD'] === 'POST') {
            $rating = (int)($_POST['rating'] ?? 5);
            $comment = trim($_POST['comment'] ?? '');

            $updateStmt = $db->prepare("UPDATE reservations SET rating = :rating, feedback_comment = :comment WHERE id = :id");
            $updateStmt->execute([':rating' => $rating, ':comment' => $comment, ':id' => $id]);

            header("Content-Type: text/html; charset=UTF-8");
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

            $updateStmt = $db->prepare("UPDATE reservations SET service_date = :service_date, status = 'RESCHEDULED' WHERE id = :id");
            $updateStmt->execute([':service_date' => $newDate, ':id' => $id]);

            $historyStmt = $db->prepare("INSERT INTO reservation_history (reservation_id, user_id, previous_status, new_status, comment) VALUES (:id, NULL, :prev, 'RESCHEDULED', :comment)");
            $historyStmt->execute([
                ':id' => $id,
                ':prev' => $reservation['status'],
                ':comment' => "Service date rescheduled to {$newDate} by customer via email link."
            ]);

            $stmtUpdated = $db->prepare("SELECT r.*, c.email, c.first_name, c.last_name, s.name as service_name FROM reservations r JOIN customers c ON r.customer_id = c.id JOIN services s ON r.service_id = s.id WHERE r.id = :id LIMIT 1");
            $stmtUpdated->execute([':id' => $id]);
            $updatedReservation = $stmtUpdated->fetch(PDO::FETCH_ASSOC);

            if ($updatedReservation) {
                EmailService::sendStatusUpdateEmail($updatedReservation, 'RESCHEDULED');
            }

            header("Content-Type: text/html; charset=UTF-8");
            echo "
            <div style='font-family: Arial, sans-serif; text-align: center; padding: 60px 20px; background-color: #f8f9fa;'>
                <div style='max-width: 500px; margin: 0 auto; background: #ffffff; padding: 40px; border-radius: 12px; border: 1px solid #e5e7eb;'>
                    <h1 style='color: #0f172a;'>Luxuria Pure</h1>
                    <h2 style='color: #9333ea;'>Date Rescheduled Successfully!</h2>
                    <p style='color: #4b5563;'>Your reservation <strong>#RES-" . str_pad((string)$id, 4, '0', STR_PAD_LEFT) . "</strong> has been updated to <strong>{$newDate}</strong>.</p>
                </div>
            </div>";
            return;
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

        header("Content-Type: text/html; charset=UTF-8");
        echo "<div style='text-align:center; padding:50px; font-family:sans-serif;'>
                <h2>Reservation Updated!</h2>
                <p>Your reservation #RES-" . str_pad((string)$id, 4, '0', STR_PAD_LEFT) . " status is now <strong>{$newStatus}</strong>.</p>
              </div>";
    }
}