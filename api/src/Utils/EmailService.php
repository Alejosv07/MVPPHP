<?php

declare(strict_types=1);

namespace App\Utils;

require_once __DIR__ . '/../Libs/PHPMailer/src/Exception.php';
require_once __DIR__ . '/../Libs/PHPMailer/src/PHPMailer.php';
require_once __DIR__ . '/../Libs/PHPMailer/src/SMTP.php';
require_once __DIR__ . '/../../config/config.php';

use App\Config\Config;
use PHPMailer\PHPMailer\Exception;
use PHPMailer\PHPMailer\PHPMailer;

/**
 * All outgoing email.
 *
 * Address roles (configure in api/config/secrets.php):
 *   MAIL_FROM      no-reply@…  sender of every automated message
 *   MAIL_REPLY_TO  bookings@…  where customer replies go
 *   MAIL_BOOKINGS  bookings@…  internal alerts: new booking, customer confirmed/cancelled/rescheduled
 *   MAIL_SUPPORT   info@…      general contact shown to customers
 *   MAIL_PRIVACY   privacy@…   shown in the Privacy Policy
 */
class EmailService
{
    /* ====================================================================
     * Public API
     * ==================================================================== */

    /** Customer-facing email for each reservation status (and reminders). */
    public static function sendStatusUpdateEmail(array $reservation, string $status): bool
    {
        $to = trim((string)($reservation['email'] ?? ''));
        if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
            error_log('Status email skipped: reservation ' . ($reservation['id'] ?? '?') . ' has no valid email');
            return false;
        }

        $status = strtoupper($status);
        $copy = self::statusCopy($reservation, $status);
        $name = self::customerName($reservation);
        $ref = self::ref($reservation);

        $html = self::layout(
            $copy['headline'],
            "<span style='display:inline-block;padding:5px 14px;border-radius:50px;color:#fff;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;background:{$copy['color']};margin-bottom:20px'>" . self::e($copy['badge']) . "</span>
            <h2 style='font-family:Georgia,serif;font-size:22px;font-weight:normal;margin:0 0 12px'>Hello " . self::e($name) . ",</h2>
            <p style='font-size:15px;line-height:1.6;color:#475569;margin:0 0 24px'>{$copy['message']}</p>"
            . self::staffNotice($reservation, $status)
            . self::detailsTable($reservation)
            . self::actionButtons($reservation, $copy['actions'])
            . "<p style='font-size:13px;color:#64748b;margin-top:20px;line-height:1.5;text-align:center'>Questions? Just reply to this email or call us at " . self::e((string)Config::get('BUSINESS_PHONE')) . '.</p>'
        );

        $text = "Hello {$name},\n\n" . strip_tags($copy['message']) . "\n\n" . self::detailsText($reservation)
            . "\nQuestions? Reply to this email or call " . Config::get('BUSINESS_PHONE') . ".\n";

        return self::send($to, $name, "{$copy['subject']} {$ref}", $html, $text);
    }

    /** Internal alert to the bookings inbox when a customer submits a request. */
    public static function sendNewBookingAlert(array $reservation): bool
    {
        $ref = self::ref($reservation);
        $name = self::customerName($reservation);
        $admin = rtrim((string)Config::get('SITE_URL'), '/') . '/admin-reservation-index.html';

        $html = self::layout('New booking request',
            "<h2 style='font-family:Georgia,serif;font-size:22px;font-weight:normal;margin:0 0 12px'>New booking request {$ref}</h2>
            <p style='font-size:15px;color:#475569'>" . self::e($name) . ' · ' . self::e((string)($reservation['email'] ?? '')) . ' · ' . self::e((string)($reservation['phone_number'] ?? '')) . '</p>'
            . self::detailsTable($reservation)
            . "<div style='text-align:center;margin:28px 0'><a href='" . self::e($admin) . "' style='background:#0f172a;color:#fff;padding:12px 22px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:13px'>Open admin panel</a></div>",
            false
        );

        return self::send((string)Config::get('MAIL_BOOKINGS'), 'Bookings', "New booking request {$ref} - {$name}", $html,
            "New booking request {$ref}\n{$name}\n" . self::detailsText($reservation), (string)($reservation['email'] ?? ''));
    }

    /** Internal alert when the customer confirms, cancels or reschedules from an email link. */
    public static function sendCustomerActionAlert(array $reservation, string $status): bool
    {
        $ref = self::ref($reservation);
        $name = self::customerName($reservation);
        $verb = ['CONFIRMED' => 'confirmed', 'CANCELLED' => 'cancelled', 'RESCHEDULED' => 'rescheduled'][$status] ?? strtolower($status);

        $html = self::layout("Customer {$verb} {$ref}",
            "<h2 style='font-family:Georgia,serif;font-size:22px;font-weight:normal;margin:0 0 12px'>" . self::e($name) . " {$verb} {$ref}</h2>"
            . self::detailsTable($reservation),
            false
        );

        return self::send((string)Config::get('MAIL_BOOKINGS'), 'Bookings', "Customer {$verb} {$ref} - {$name}", $html,
            "{$name} {$verb} {$ref}\n" . self::detailsText($reservation), (string)($reservation['email'] ?? ''));
    }

    public static function sendPasswordResetEmail(array $user, string $code): bool
    {
        $name = (string)($user['name'] ?? 'there');
        $html = self::layout('Password reset code',
            "<h2 style='font-family:Georgia,serif;font-size:22px;font-weight:normal;margin:0 0 12px'>Hello " . self::e($name) . ",</h2>
            <p style='font-size:15px;line-height:1.6;color:#475569'>We received a request to reset the password of your Luxuria Pure staff account. Use this code within <strong>15 minutes</strong>:</p>"
            . self::codeBox('Your reset code', $code)
            . "<p style='font-size:13px;color:#475569;text-align:center'>If you didn't request this, you can ignore this email — your password won't change.</p>",
            false
        );

        return self::send((string)$user['email'], $name, 'Your password reset code', $html,
            "Your Luxuria Pure password reset code is {$code}. It expires in 15 minutes. If you didn't request it, ignore this email.");
    }

    public static function sendOtpEmail(string $recipientEmail, string $code): bool
    {
        $html = self::layout('Your security PIN',
            "<h2 style='font-family:Georgia,serif;font-size:22px;font-weight:normal;margin:0 0 12px'>Hello,</h2>
            <p style='font-size:15px;line-height:1.6;color:#475569'>Use this PIN to view your bookings and leave feedback. It is valid for <strong>10 minutes</strong> and can be used once:</p>"
            . self::codeBox('Your security PIN', $code)
            . "<p style='font-size:13px;color:#475569;text-align:center'>If you didn't request this code, you can ignore this email.</p>"
        );

        return self::send($recipientEmail, '', 'Your Luxuria Pure security PIN', $html,
            "Your Luxuria Pure security PIN is {$code}. It is valid for 10 minutes.");
    }

    /* ====================================================================
     * Content per status
     * ==================================================================== */

    private static function statusCopy(array $res, string $status): array
    {
        $date = self::date($res);
        $hasPrice = (float)($res['total_price'] ?? 0) > 0;
        $confirmOrNot = $hasPrice ? ['confirm', 'reschedule', 'cancel'] : ['reschedule', 'cancel'];

        return match ($status) {
            'PENDING' => [
                'subject' => 'We received your booking request', 'badge' => 'Request received', 'color' => '#b45309',
                'headline' => 'Booking request received',
                'message' => $hasPrice
                    ? 'Thank you for choosing Luxuria Pure. Please review the details and price below and confirm your appointment.'
                    : "Thank you for choosing Luxuria Pure. We've received your request for <strong>{$date}</strong>. Our team will review availability and send you a price quote within one business day. <strong>Nothing is charged until you confirm.</strong>",
                'actions' => $confirmOrNot,
            ],
            'CONFIRMED' => [
                'subject' => 'Your cleaning is confirmed', 'badge' => 'Confirmed', 'color' => '#15803d',
                'headline' => 'Your cleaning is confirmed',
                'message' => "Your appointment for <strong>{$date}</strong> is confirmed. Please make sure our team can access the property at the scheduled time. Free cancellation up to 48 hours before the service.",
                'actions' => ['reschedule', 'cancel'],
            ],
            'RESCHEDULED' => [
                'subject' => 'Your appointment has a new date', 'badge' => 'Rescheduled', 'color' => '#9333ea',
                'headline' => 'New date for your cleaning',
                'message' => "Your appointment has been moved to <strong>{$date}</strong>." . ($hasPrice ? ' Please confirm the new date below.' : ' We will confirm availability shortly.'),
                'actions' => $confirmOrNot,
            ],
            'ON_THE_WAY' => [
                'subject' => 'Your cleaner is on the way', 'badge' => 'On the way', 'color' => '#d97706',
                'headline' => 'Your cleaner is on the way',
                'message' => 'Our team is heading to your address now and will arrive shortly.',
                'actions' => [],
            ],
            'INITIATED' => [
                'subject' => 'Your cleaning has started', 'badge' => 'In progress', 'color' => '#1d4ed8',
                'headline' => 'Your cleaning has started',
                'message' => "Our team has arrived and started your service. We'll let you know as soon as it's finished.",
                'actions' => [],
            ],
            'COMPLETED' => [
                'subject' => 'Your cleaning is complete — how did we do?', 'badge' => 'Completed', 'color' => '#059669',
                'headline' => 'Service completed',
                'message' => 'Your cleaning is complete. Thank you for trusting Luxuria Pure! If anything isn\'t right, reply within 24 hours and we\'ll come back to fix it at no cost. We\'d love to hear your feedback.',
                'actions' => ['feedback'],
            ],
            'CANCELLED' => [
                'subject' => 'Your reservation has been cancelled', 'badge' => 'Cancelled', 'color' => '#b91c1c',
                'headline' => 'Reservation cancelled',
                'message' => 'Your reservation has been cancelled. If this was a mistake or you want to book another date, just reply to this email.',
                'actions' => [],
            ],
            'REJECTED' => [
                'subject' => "We can't take this booking", 'badge' => 'Not available', 'color' => '#b91c1c',
                'headline' => 'We are unable to take this booking',
                'message' => "Unfortunately we can't accommodate this request (the date may be fully booked or the address may be outside our service area). You have not been charged. Reply to this email and we'll gladly suggest another option.",
                'actions' => [],
            ],
            'REMINDER' => [
                'subject' => 'Reminder: your cleaning is coming up', 'badge' => 'Reminder', 'color' => '#0f172a',
                'headline' => 'Upcoming cleaning reminder',
                'message' => "This is a friendly reminder that your cleaning is scheduled for <strong>{$date}</strong>. Need to change it? Use the buttons below (free up to 48 hours before).",
                'actions' => ['reschedule', 'cancel'],
            ],
            default => [
                'subject' => 'Update on your reservation', 'badge' => str_replace('_', ' ', $status), 'color' => '#0f172a',
                'headline' => 'Reservation update',
                'message' => 'There is an update on your reservation. Please review the details below.',
                'actions' => [],
            ],
        };
    }

    /* ====================================================================
     * Building blocks
     * ==================================================================== */

    private static function mailer(): PHPMailer
    {
        $mail = new PHPMailer(true);
        $mail->isSMTP();
        $mail->Host       = (string)Config::get('SMTP_HOST');
        $mail->SMTPAuth   = true;
        $mail->Username   = (string)Config::get('SMTP_USER');
        $mail->Password   = (string)Config::get('SMTP_PASSWORD');
        $mail->SMTPSecure = Config::get('SMTP_SECURE') === 'ssl' ? PHPMailer::ENCRYPTION_SMTPS : PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = (int)Config::get('SMTP_PORT');
        $mail->CharSet    = 'UTF-8';
        $mail->Timeout    = 15;

        $mail->setFrom((string)Config::get('MAIL_FROM'), (string)Config::get('MAIL_FROM_NAME'));
        $mail->addReplyTo((string)Config::get('MAIL_REPLY_TO'), (string)Config::get('MAIL_FROM_NAME'));
        return $mail;
    }

    private static function send(string $to, string $name, string $subject, string $html, string $text, string $replyTo = ''): bool
    {
        if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
            return false;
        }
        try {
            $mail = self::mailer();
            if ($replyTo !== '' && filter_var($replyTo, FILTER_VALIDATE_EMAIL)) {
                $mail->clearReplyTos();
                $mail->addReplyTo($replyTo);
            }
            $mail->addAddress($to, $name);
            $mail->isHTML(true);
            $mail->Subject = $subject . ' - Luxuria Pure';
            $mail->Body = $html;
            $mail->AltBody = $text;
            return $mail->send();
        } catch (Exception $e) {
            error_log('Email "' . $subject . '" failed: ' . $e->getMessage());
            return false;
        }
    }

    private static function layout(string $title, string $content, bool $customerFooter = true): string
    {
        $site = rtrim((string)Config::get('SITE_URL'), '/');
        $brand = self::e((string)Config::get('BUSINESS_NAME'));
        $address = trim((string)Config::get('BUSINESS_ADDRESS'));
        $support = self::e((string)Config::get('MAIL_SUPPORT'));
        $phone = self::e((string)Config::get('BUSINESS_PHONE'));
        $year = date('Y');

        $footer = $customerFooter
            ? "{$brand}" . ($address !== '' ? ' · ' . self::e($address) : '') . "<br>{$phone} · <a href='mailto:{$support}' style='color:#64748b'>{$support}</a><br>
               <a href='{$site}/terms-of-service.html' style='color:#64748b'>Terms</a> · <a href='{$site}/cancellation-policy.html' style='color:#64748b'>Cancellation Policy</a> · <a href='{$site}/privacy-policy.html' style='color:#64748b'>Privacy Policy</a><br>
               You are receiving this transactional email because you requested a service from us.<br>&copy; {$year} {$brand}"
            : "Internal notification · &copy; {$year} {$brand}";

        return "<!DOCTYPE html><html lang='en'><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>" . self::e($title) . "</title></head>
<body style='margin:0;padding:32px 12px;background:#f8f9fa;font-family:Helvetica,Arial,sans-serif;color:#0f172a'>
<div style='max-width:580px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0'>
  <div style='background:#0f172a;padding:30px 20px;text-align:center'><div style='font-family:Georgia,serif;color:#d4af37;font-size:30px;text-transform:uppercase;letter-spacing:-0.5px'>Luxuria Pure</div></div>
  <div style='padding:36px 30px'>{$content}</div>
  <div style='background:#f1f5f9;padding:22px 30px;text-align:center;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.7;color:#64748b'>{$footer}</div>
</div></body></html>";
    }

    private static function codeBox(string $label, string $code): string
    {
        return "<div style='background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:22px;text-align:center;margin:24px 0'>
            <div style='font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:8px;font-weight:600'>" . self::e($label) . "</div>
            <div style='font-size:32px;font-weight:bold;letter-spacing:6px;color:#d4af37;font-family:monospace'>" . self::e($code) . '</div></div>';
    }

    private static function rows(array $res): array
    {
        $price = (float)($res['total_price'] ?? 0);
        $time = !empty($res['preferred_time']) ? date('g:i A', strtotime((string)$res['preferred_time'])) : 'To be confirmed';

        return [
            'Reservation'     => self::ref($res),
            'Service'         => (string)($res['service_name'] ?? 'Cleaning service'),
            'Date & time'     => self::date($res) . ' at ' . $time,
            'Home'            => ($res['bedrooms'] ?? '-') . ' bed / ' . ($res['bathrooms'] ?? '-') . ' bath',
            'Frequency'       => (string)($res['frequency'] ?? 'One-time'),
            'Address'         => (string)($res['service_address'] ?? ''),
            'Instructions'    => trim((string)($res['special_instructions'] ?? '')) ?: 'None',
            'Total'           => $price > 0 ? '$' . number_format($price, 2) : 'Quote pending',
        ];
    }

    private static function detailsTable(array $res): string
    {
        $html = "<div style='background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 20px;margin-bottom:20px'><table style='width:100%;border-collapse:collapse'>";
        foreach (self::rows($res) as $label => $value) {
            $isTotal = $label === 'Total';
            $html .= "<tr><td style='padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:600;vertical-align:top'>" . self::e($label) . "</td>
                <td style='padding:10px 0 10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:14px;font-weight:600;color:" . ($isTotal ? '#b8912a' : '#0f172a') . "'>" . nl2br(self::e($value)) . '</td></tr>';
        }
        return $html . '</table></div>';
    }

    private static function detailsText(array $res): string
    {
        $out = '';
        foreach (self::rows($res) as $label => $value) {
            $out .= str_pad($label . ':', 16) . $value . "\n";
        }
        return $out;
    }

    private static function staffNotice(array $res, string $status): string
    {
        $staff = trim((string)($res['staff_name'] ?? ''));
        if ($staff === '' || !in_array($status, ['CONFIRMED', 'RESCHEDULED', 'ON_THE_WAY', 'INITIATED', 'REMINDER'], true)) {
            return '';
        }
        // First name only, for staff privacy
        $first = self::e(explode(' ', $staff)[0]);
        return "<div style='background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px;margin-bottom:20px;font-size:14px;color:#166534'><strong>Your cleaner:</strong> {$first}</div>";
    }

    private static function actionButtons(array $res, array $actions): string
    {
        if (!$actions || empty($res['id']) || empty($res['email'])) {
            return '';
        }

        $token = Auth::reservationLinkToken((int)$res['id'], (string)$res['email']);
        $base = rtrim((string)Config::get('APP_URL'), '/') . '/api/public/reservations?id=' . (int)$res['id'] . '&token=' . $token;

        $styles = [
            'confirm'    => ['Confirm', '#0f172a'],
            'reschedule' => ['Reschedule', '#9333ea'],
            'cancel'     => ['Cancel', '#b91c1c'],
            'feedback'   => ['Rate your service', '#059669'],
        ];

        $buttons = '';
        foreach ($actions as $action) {
            [$label, $color] = $styles[$action];
            $url = self::e("{$base}&action={$action}");
            $buttons .= "<a href='{$url}' style='background:{$color};color:#fff;padding:12px 18px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:13px;margin:4px;display:inline-block'>{$label}</a>";
        }
        return "<div style='text-align:center;margin:28px 0 12px'>{$buttons}</div>";
    }

    private static function customerName(array $res): string
    {
        $name = trim(($res['first_name'] ?? '') . ' ' . ($res['last_name'] ?? ''));
        return $name !== '' ? $name : (string)($res['customer_name'] ?? 'Valued Customer');
    }

    private static function ref(array $res): string
    {
        return '#RES-' . str_pad((string)($res['id'] ?? 0), 4, '0', STR_PAD_LEFT);
    }

    private static function date(array $res): string
    {
        return !empty($res['service_date']) ? date('l, F j, Y', strtotime((string)$res['service_date'])) : 'a date to be confirmed';
    }

    private static function e(string $s): string
    {
        return htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
    }
}
