<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Config\Config;
use App\Config\Database;
use App\Models\AuditModel;
use App\Utils\Auth;
use App\Utils\BookingRules;
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
    private const ACTIONABLE = ['PENDING', 'QUOTED', 'CONFIRMED', 'RESCHEDULED'];

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

        if ($action === 'confirm') {
            // There is nothing to accept until the team has sent a price
            if ((float)($reservation['total_price'] ?? 0) <= 0) {
                $this->page('Quote pending', "<p>We're still preparing the price for reservation <strong>{$ref}</strong>. You'll receive an email with a Confirm button as soon as it's ready.</p>");
            }
            if ($status === 'CONFIRMED') {
                $this->page('Already confirmed', "<p>Reservation <strong>{$ref}</strong> is already confirmed. See you soon!</p>", 'success');
            }
            // A date the customer asked for must be approved by the team, not by the customer
            if ($status === 'RESCHEDULED' && $this->rescheduledByCustomer($id)) {
                $this->page('We are checking your new date', "<p>We received your request to move reservation <strong>{$ref}</strong>. Our team will confirm the new date by email shortly.</p>");
            }
        }

        // Changes close to the appointment are handled by phone (Cancellation Policy)
        if ($action === 'reschedule' && $status === 'CONFIRMED'
            && BookingRules::isWithin((string)$reservation['service_date'], (string)$reservation['preferred_time'], 48)) {
            $this->page('Please contact us', "<p>Your appointment <strong>{$ref}</strong> is less than 48 hours away, so it can't be moved online. Please call us at "
                . self::e((string)Config::get('BUSINESS_PHONE')) . ' or reply to our email and we will help you.</p>');
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
            SELECT r.*, c.email, c.first_name, c.last_name, s.name AS service_name, u.name AS staff_name, u.email AS staff_email
            FROM reservations r
            JOIN customers c ON r.customer_id = c.id
            JOIN services s ON r.service_id = s.id
            LEFT JOIN users u ON r.staff_id = u.id
            WHERE r.id = :id LIMIT 1
        ');
        $stmt->execute([':id' => $id]);
        return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    /** True when the last move to RESCHEDULED came from the customer (email link history rows have no user). */
    private function rescheduledByCustomer(int $id): bool
    {
        $stmt = $this->db->prepare("SELECT user_id FROM reservation_history WHERE reservation_id = :id AND new_status = 'RESCHEDULED' ORDER BY id DESC LIMIT 1");
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row !== false && $row['user_id'] === null;
    }

    /* ---------- Actions ---------- */

    private function changeStatus(array $reservation, string $newStatus, string $ref): never
    {
        $id = (int)$reservation['id'];
        $this->db->prepare('UPDATE reservations SET status = :status WHERE id = :id')
            ->execute([':status' => $newStatus, ':id' => $id]);
        $this->history($id, $reservation['status'], $newStatus, "Status updated to {$newStatus} by customer via email link.");

        if ($updated = $this->find($id)) {
            EmailService::sendStatusUpdateEmail($updated, $newStatus, ['by' => 'customer']);
            EmailService::sendCustomerActionAlert($updated, $newStatus);
            EmailService::notifyStaffOfChange($reservation, $updated);
        }

        $newStatus === 'CONFIRMED'
            ? $this->page('Reservation confirmed', "<p>Thank you! Reservation <strong>{$ref}</strong> is confirmed. We'll see you soon.</p>", 'success')
            : $this->page('Reservation cancelled', "<p>Reservation <strong>{$ref}</strong> has been cancelled. Please review our Cancellation Policy for any applicable fees.</p>");
    }

    private function reschedule(array $reservation, string $ref): never
    {
        $newDate = (string)($_POST['service_date'] ?? '');
        $newTime = (string)($_POST['preferred_time'] ?? substr((string)$reservation['preferred_time'], 0, 5));
        $d = \DateTimeImmutable::createFromFormat('Y-m-d', $newDate);
        $back = '<p>Please go back and try again.</p>';

        if (!$d || $d->format('Y-m-d') !== $newDate || $newDate <= date('Y-m-d') || $newDate > date('Y-m-d', strtotime('+1 year'))) {
            $this->page('Invalid date', '<p>Please choose a future date within the next 12 months.</p>' . $back, 'error');
        }
        if (!preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $newTime)) {
            $this->page('Invalid time', '<p>Please choose a valid time.</p>' . $back, 'error');
        }
        if ($newDate === (string)$reservation['service_date'] && $newTime === substr((string)$reservation['preferred_time'], 0, 5)) {
            $this->page('Same date', '<p>That is already the date and time of your appointment. Please choose a different one.</p>' . $back, 'error');
        }
        $service = (new \App\Models\ServiceModel())->getById((int)$reservation['service_id']);
        if ($error = BookingRules::scheduleError($newDate, $newTime, $service)) {
            $this->page('Date not available', '<p>' . self::e($error) . '</p>' . $back, 'error');
        }

        $id = (int)$reservation['id'];
        $this->db->prepare("UPDATE reservations SET service_date = :d, preferred_time = :t, status = 'RESCHEDULED' WHERE id = :id")
            ->execute([':d' => $newDate, ':t' => $newTime . ':00', ':id' => $id]);
        $this->history($id, $reservation['status'], 'RESCHEDULED', "Customer asked to move the service to {$newDate} {$newTime} via email link.");

        if ($updated = $this->find($id)) {
            EmailService::sendStatusUpdateEmail($updated, 'RESCHEDULED', ['by' => 'customer']);
            EmailService::sendCustomerActionAlert($updated, 'RESCHEDULED');
            // The cleaner is told to hold; they get the new date once the office confirms it
            EmailService::notifyStaffOfChange($reservation, $updated);
        }

        $when = self::e(date('F j, Y', strtotime($newDate)) . ' at ' . date('g:i A', strtotime($newTime)));
        $this->page('Request received', "<p>We received your request to move reservation <strong>{$ref}</strong> to <strong>{$when}</strong>. Our team will check availability and confirm by email shortly.</p>", 'success');
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

        if ($reservation = $this->find($id)) {
            $note = str_repeat('★', $rating) . str_repeat('☆', 5 - $rating) . ' (' . $rating . '/5)'
                . ($comment !== '' ? '<br>"' . self::e($comment) . '"' : '');
            EmailService::sendTeamAlert($reservation, "New {$rating}-star rating for {$ref}", $note);
        }

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
        $max = date('Y-m-d', strtotime('+1 year'));
        $current = self::e((string)($reservation['service_date'] ?? $min));
        $time = self::e(substr((string)($reservation['preferred_time'] ?? '09:00'), 0, 5));
        $label = "display:block;text-align:left;font-size:12px;font-weight:bold;color:#475569;text-transform:uppercase;margin-bottom:8px";
        $input = "width:100%;padding:12px;border:1px solid #cbd5e1;border-radius:6px;font-size:15px;box-sizing:border-box;margin-bottom:20px";

        $this->page('Reschedule service', "
            <p>Reservation <strong>{$ref}</strong></p>
            <form method='POST'>
                <label style='{$label}'>New date</label>
                <input type='date' name='service_date' value='{$current}' min='{$min}' max='{$max}' required style='{$input}'>
                <label style='{$label}'>Preferred time</label>
                <input type='time' name='preferred_time' value='{$time}' required style='{$input}'>
                <p style='font-size:13px;color:#64748b;margin:0 0 20px'>Our team will confirm the new date by email. Your current appointment stays on hold until then.</p>
                <button type='submit' style='width:100%;background:#0f172a;color:#fff;padding:14px;border:0;border-radius:6px;font-weight:bold;font-size:14px;cursor:pointer'>Request new date</button>
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
