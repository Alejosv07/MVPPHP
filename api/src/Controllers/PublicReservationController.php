<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Config\Config;
use App\Config\Database;
use App\Models\AuditModel;
use App\Utils\Auth;
use App\Utils\EmailService;
use App\Utils\RateLimiter;
use PDO;

/**
 * Handles the Confirm / Reschedule / Cancel / Feedback links sent by email.
 *
 * GET always shows a page with a button; the change happens only on POST.
 * (Email security scanners pre-open links, so GET must never modify data.)
 */
class PublicReservationController
{
    private const ACTIONABLE = ['PENDING', 'CONFIRMED', 'RESCHEDULED'];

    private PDO $db;

    public function __construct()
    {
        $this->db = (new Database())->getConnection();
    }

    public function handleAction(): void
    {
        header('Content-Type: text/html; charset=UTF-8');
        header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'");
        header('X-Robots-Tag: noindex, nofollow');

        RateLimiter::hit('email-link-ip', Auth::clientIp(), 60, 3600);

        $id = (int)($_GET['id'] ?? 0);
        $token = (string)($_GET['token'] ?? '');
        $action = (string)($_GET['action'] ?? '');
        $isPost = $_SERVER['REQUEST_METHOD'] === 'POST';

        $reservation = $id > 0 ? $this->find($id) : null;

        if (!$reservation || !hash_equals(Auth::reservationLinkToken($id, (string)$reservation['email']), $token)) {
            $this->page('Link not valid', '<p>This link is invalid or has expired. Please contact us if you need help with your booking.</p>', 'error');
        }

        $ref = self::ref($id);
        $status = (string)$reservation['status'];

        if ($action === 'feedback') {
            if ($status !== 'COMPLETED') {
                $this->page('Not available yet', "<p>You can rate reservation <strong>{$ref}</strong> once the service has been completed.</p>");
            }
            $isPost ? $this->saveFeedback($id, $ref) : $this->feedbackForm($ref);
        }

        if (!in_array($status, self::ACTIONABLE, true)) {
            $label = self::e(str_replace('_', ' ', $status));
            $this->page('No changes possible', "<p>Reservation <strong>{$ref}</strong> is currently <strong>{$label}</strong> and can no longer be changed online. Please contact us at " . self::e((string)Config::get('MAIL_SUPPORT')) . ' or ' . self::e((string)Config::get('BUSINESS_PHONE')) . '.</p>');
        }

        match ($action) {
            'reschedule' => $isPost ? $this->reschedule($reservation, $ref) : $this->rescheduleForm($reservation, $ref),
            'confirm'    => $isPost ? $this->changeStatus($reservation, 'CONFIRMED', $ref) : $this->confirmForm($ref, 'confirm'),
            'cancel'     => $isPost ? $this->changeStatus($reservation, 'CANCELLED', $ref) : $this->confirmForm($ref, 'cancel'),
            default      => $this->page('Link not valid', '<p>Unknown action.</p>', 'error'),
        };
    }

    private function find(int $id): ?array
    {
        $stmt = $this->db->prepare('
            SELECT r.*, c.email, c.first_name, c.last_name, s.name AS service_name, u.name AS staff_name
            FROM reservations r
            JOIN customers c ON r.customer_id = c.id
            JOIN services s ON r.service_id = s.id
            LEFT JOIN users u ON r.staff_id = u.id
            WHERE r.id = :id LIMIT 1
        ');
        $stmt->execute([':id' => $id]);
        return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    /* ---------- Actions ---------- */

    private function changeStatus(array $reservation, string $newStatus, string $ref): never
    {
        $id = (int)$reservation['id'];
        $this->db->prepare('UPDATE reservations SET status = :status WHERE id = :id')
            ->execute([':status' => $newStatus, ':id' => $id]);
        $this->history($id, $reservation['status'], $newStatus, "Status updated to {$newStatus} by customer via email link.");

        if ($updated = $this->find($id)) {
            EmailService::sendStatusUpdateEmail($updated, $newStatus);
            EmailService::sendCustomerActionAlert($updated, $newStatus);
        }

        $newStatus === 'CONFIRMED'
            ? $this->page('Reservation confirmed', "<p>Thank you! Reservation <strong>{$ref}</strong> is confirmed. We'll see you soon.</p>", 'success')
            : $this->page('Reservation cancelled', "<p>Reservation <strong>{$ref}</strong> has been cancelled. Please review our Cancellation Policy for any applicable fees.</p>");
    }

    private function reschedule(array $reservation, string $ref): never
    {
        $newDate = (string)($_POST['service_date'] ?? '');
        $d = \DateTimeImmutable::createFromFormat('Y-m-d', $newDate);

        if (!$d || $d->format('Y-m-d') !== $newDate || $newDate <= date('Y-m-d')) {
            $this->page('Invalid date', '<p>Please choose a valid future date.</p><p>Please go back and try again.</p>', 'error');
        }

        $id = (int)$reservation['id'];
        $this->db->prepare("UPDATE reservations SET service_date = :d, status = 'RESCHEDULED' WHERE id = :id")
            ->execute([':d' => $newDate, ':id' => $id]);
        $this->history($id, $reservation['status'], 'RESCHEDULED', "Service date rescheduled to {$newDate} by customer via email link.");

        if ($updated = $this->find($id)) {
            EmailService::sendStatusUpdateEmail($updated, 'RESCHEDULED');
            EmailService::sendCustomerActionAlert($updated, 'RESCHEDULED');
        }

        $this->page('Date updated', "<p>Reservation <strong>{$ref}</strong> has been moved to <strong>" . self::e(date('F j, Y', strtotime($newDate))) . '</strong>. Our team will confirm the new date shortly.</p>', 'success');
    }

    private function saveFeedback(int $id, string $ref): never
    {
        $rating = max(1, min(5, (int)($_POST['rating'] ?? 5)));
        $comment = mb_substr(trim((string)($_POST['comment'] ?? '')), 0, 1000);

        $this->db->prepare('
            INSERT INTO reservation_ratings (reservation_id, customer_rating, customer_notes)
            VALUES (:id, :rating, :comment)
            ON DUPLICATE KEY UPDATE customer_rating = VALUES(customer_rating), customer_notes = VALUES(customer_notes)
        ')->execute([':id' => $id, ':rating' => $rating, ':comment' => $comment ?: null]);

        $this->page('Thank you for your feedback!', "<p>Your rating for reservation <strong>{$ref}</strong> has been saved.</p>", 'success');
    }

    private function history(int $id, ?string $prev, string $new, string $comment): void
    {
        $this->db->prepare('INSERT INTO reservation_history (reservation_id, user_id, previous_status, new_status, comment) VALUES (:id, NULL, :prev, :new, :comment)')
            ->execute([':id' => $id, ':prev' => $prev, ':new' => $new, ':comment' => $comment]);

        (new AuditModel())->log(null, 'UPDATE', 'reservations', $id, json_encode(['method' => 'EMAIL_LINK', 'new_status' => $new]), Auth::clientIp());
    }

    /* ---------- Forms ---------- */

    private function confirmForm(string $ref, string $action): never
    {
        $isCancel = $action === 'cancel';
        $body = $isCancel
            ? "<p>Do you want to cancel reservation <strong>{$ref}</strong>?</p><p style='font-size:13px;color:#64748b'>Cancellations made less than 48 hours before the appointment may be subject to a fee, as described in our Cancellation Policy.</p>"
            : "<p>Please confirm reservation <strong>{$ref}</strong>.</p>";
        $button = $isCancel ? 'Yes, cancel my reservation' : 'Confirm reservation';
        $color = $isCancel ? '#b91c1c' : '#0f172a';

        $this->page($isCancel ? 'Cancel reservation' : 'Confirm reservation',
            $body . "<form method='POST'><button type='submit' style='width:100%;background:{$color};color:#fff;padding:14px;border:0;border-radius:6px;font-weight:bold;font-size:14px;cursor:pointer'>{$button}</button></form>");
    }

    private function rescheduleForm(array $reservation, string $ref): never
    {
        $min = date('Y-m-d', strtotime('+1 day'));
        $current = self::e((string)($reservation['service_date'] ?? $min));

        $this->page('Reschedule service', "
            <p>Reservation <strong>{$ref}</strong></p>
            <form method='POST'>
                <label style='display:block;text-align:left;font-size:12px;font-weight:bold;color:#475569;text-transform:uppercase;margin-bottom:8px'>Select new date</label>
                <input type='date' name='service_date' value='{$current}' min='{$min}' required style='width:100%;padding:12px;border:1px solid #cbd5e1;border-radius:6px;font-size:15px;box-sizing:border-box;margin-bottom:20px'>
                <button type='submit' style='width:100%;background:#0f172a;color:#fff;padding:14px;border:0;border-radius:6px;font-weight:bold;font-size:14px;cursor:pointer'>Save new date</button>
            </form>");
    }

    private function feedbackForm(string $ref): never
    {
        $options = '';
        foreach ([5 => 'Excellent', 4 => 'Very good', 3 => 'Good', 2 => 'Fair', 1 => 'Poor'] as $v => $label) {
            $options .= "<option value='{$v}'>" . str_repeat('★', $v) . " ({$v} - {$label})</option>";
        }

        $this->page('Rate our service', "
            <p>Reservation <strong>{$ref}</strong></p>
            <form method='POST' style='text-align:left'>
                <label style='display:block;font-size:12px;font-weight:bold;color:#475569;text-transform:uppercase;margin-bottom:8px'>Rating</label>
                <select name='rating' style='width:100%;padding:12px;border:1px solid #cbd5e1;border-radius:6px;font-size:15px;margin-bottom:20px'>{$options}</select>
                <label style='display:block;font-size:12px;font-weight:bold;color:#475569;text-transform:uppercase;margin-bottom:8px'>Comment</label>
                <textarea name='comment' rows='4' maxlength='1000' placeholder='Tell us about your experience...' style='width:100%;padding:12px;border:1px solid #cbd5e1;border-radius:6px;font-size:15px;box-sizing:border-box;margin-bottom:20px'></textarea>
                <p style='font-size:12px;color:#64748b'>By submitting, you allow us to display your first name, last initial, rating and comment on our website. See our Privacy Policy.</p>
                <button type='submit' style='width:100%;background:#059669;color:#fff;padding:14px;border:0;border-radius:6px;font-weight:bold;font-size:14px;cursor:pointer'>Submit rating</button>
            </form>");
    }

    /* ---------- Helpers ---------- */

    private static function e(string $s): string
    {
        return htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
    }

    private static function ref(int $id): string
    {
        return '#RES-' . str_pad((string)$id, 4, '0', STR_PAD_LEFT);
    }

    private function page(string $title, string $bodyHtml, string $tone = 'neutral'): never
    {
        $color = ['success' => '#059669', 'error' => '#b91c1c'][$tone] ?? '#0f172a';
        $brand = self::e((string)Config::get('BUSINESS_NAME'));
        $site = self::e(rtrim((string)Config::get('SITE_URL'), '/'));
        $t = self::e($title);

        echo "<!DOCTYPE html><html lang='en'><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>{$t} - {$brand}</title></head>
<body style='margin:0;font-family:Arial,Helvetica,sans-serif;background:#f8f9fa;padding:60px 16px;color:#0f172a'>
<div style='max-width:460px;margin:0 auto;background:#fff;padding:40px;border-radius:12px;border:1px solid #e2e8f0;text-align:center'>
<div style='font-family:Georgia,serif;font-size:22px;color:#0f172a;margin-bottom:12px'>Luxuria Pure</div>
<h2 style='color:{$color};font-size:20px;margin:0 0 16px'>{$t}</h2>
<div style='color:#475569;font-size:15px;line-height:1.6'>{$bodyHtml}</div>
<p style='margin-top:28px;font-size:12px;color:#94a3b8'><a href='{$site}/terms-of-service.html' style='color:#94a3b8'>Terms</a> · <a href='{$site}/cancellation-policy.html' style='color:#94a3b8'>Cancellation Policy</a> · <a href='{$site}/privacy-policy.html' style='color:#94a3b8'>Privacy</a></p>
</div></body></html>";
        exit;
    }
}
