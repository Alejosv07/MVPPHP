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

class EmailService
{

    public static function sendStatusUpdateEmail(array $reservation, string $status, array $context = []): bool
    {
        $to = trim((string)($reservation['email'] ?? ''));
        if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
            error_log('Status email skipped: reservation ' . ($reservation['id'] ?? '?') . ' has no valid email');
            return false;
        }

        $status = strtoupper($status);
        $copy = self::statusCopy($reservation, $status, $context);
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

        return self::send($to, $name, "{$copy['subject']} · {$ref}", $html, $text);
    }

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

    public static function sendStaffJobEmail(array $reservation, string $kind): bool
    {
        $to = trim((string)($reservation['staff_email'] ?? ''));
        if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
            return false;
        }

        $ref = self::ref($reservation);
        $date = self::date($reservation);
        $short = self::shortDate($reservation);
        $staff = trim((string)($reservation['staff_name'] ?? ''));
        $first = explode(' ', $staff)[0] ?: 'there';
        $panel = rtrim((string)Config::get('SITE_URL'), '/') . '/employee-execution.html';

        [$subject, $headline, $message] = match ($kind) {
            'cancelled'   => ["Job cancelled: {$short}", 'Job cancelled', "Job {$ref} on <strong>{$date}</strong> has been cancelled. You don't need to go to this address."],
            'rescheduled' => ["Job moved to {$short}", 'Job rescheduled', "Job {$ref} has a new date: <strong>{$date}</strong>. Please check your schedule."],
            default       => ["New job assigned: {$short}", 'New job assigned', "You have been assigned job {$ref} on <strong>{$date}</strong>. The details are below."],
        };
        $withDetails = $kind !== 'cancelled';

        $html = self::layout($headline,
            "<h2 style='font-family:Georgia,serif;font-size:22px;font-weight:normal;margin:0 0 12px'>Hello " . self::e($first) . ",</h2>
            <p style='font-size:15px;line-height:1.6;color:#475569;margin:0 0 24px'>{$message}</p>"
            . ($withDetails ? self::detailsTable($reservation, false) : '')
            . "<div style='text-align:center;margin:28px 0'><a href='" . self::e($panel) . "' style='background:#0f172a;color:#fff;padding:12px 22px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:13px'>Open my jobs</a></div>",
            false
        );

        $text = "Hello {$first},\n\n" . strip_tags($message) . "\n\n" . ($withDetails ? self::detailsText($reservation, false) : '') . "\nMy jobs: {$panel}\n";

        return self::send($to, $staff, "{$subject} · {$ref}", $html, $text);
    }

    public static function sendPasswordChangedEmail(array $user): bool
    {
        $name = (string)($user['name'] ?? 'there');
        $support = (string)Config::get('MAIL_SUPPORT');
        $when = date('F j, Y \a\t g:i A T');

        $html = self::layout('Your password was changed',
            "<h2 style='font-family:Georgia,serif;font-size:22px;font-weight:normal;margin:0 0 12px'>Hello " . self::e($name) . ",</h2>
            <p style='font-size:15px;line-height:1.6;color:#475569'>The password of your Luxuria Pure staff account was changed on <strong>" . self::e($when) . "</strong>. For your security, every open session has been signed out.</p>
            <p style='font-size:13px;color:#475569'>If you didn't make this change, contact your administrator or " . self::e($support) . ' right away.</p>',
            false
        );

        return self::send((string)($user['email'] ?? ''), $name, 'Your password was changed', $html,
            "The password of your Luxuria Pure staff account was changed on {$when}. All sessions were signed out. If this wasn't you, contact {$support} right away.");
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

    private static function statusCopy(array $res, string $status, array $ctx = []): array
    {
        $date = self::date($res);
        $short = self::shortDate($res);
        $hasPrice = (float)($res['total_price'] ?? 0) > 0;
        $byCustomer = ($ctx['by'] ?? 'team') === 'customer';
        $updated = !empty($ctx['updated']);
        $bookings = self::e((string)Config::get('MAIL_REPLY_TO'));
        $policy = "<a href='" . self::e(rtrim((string)Config::get('SITE_URL'), '/')) . "/cancellation-policy.html' style='color:#475569'>Cancellation Policy</a>";

        $copy = match ($status) {
            // With a price it is a quote to accept; without one there is nothing to confirm yet
            'PENDING' => $hasPrice
                ? [
                    'subject' => "Your quote is ready: please confirm {$short}", 'badge' => 'Quote ready', 'color' => '#b45309',
                    'headline' => 'Your quote is ready',
                    'message' => "Thank you for choosing Luxuria Pure. Your price for <strong>{$date}</strong> is below. <strong>Your appointment is booked only after you press Confirm.</strong>",
                    'actions' => ['confirm', 'reschedule', 'cancel'],
                ]
                : [
                    'subject' => 'We received your booking request', 'badge' => 'Request received', 'color' => '#b45309',
                    'headline' => 'Booking request received',
                    'message' => "Thank you for choosing Luxuria Pure. We've received your request for <strong>{$date}</strong>. Our team will check availability and email you a price quote within one business day. <strong>Nothing is booked or charged until you accept the quote.</strong>",
                    'actions' => ['cancel'],
                ],
            'CONFIRMED' => [
                'subject' => $byCustomer ? "Thanks! Your cleaning on {$short} is confirmed" : "Your cleaning on {$short} is confirmed",
                'badge' => 'Confirmed', 'color' => '#15803d',
                'headline' => 'Your cleaning is confirmed',
                'message' => "Your appointment for <strong>{$date}</strong> is confirmed. Please make sure our team can access the property at the scheduled time. You can reschedule or cancel for free up to 48 hours before the service ({$policy}).",
                'actions' => ['reschedule', 'cancel'],
            ],
            'RESCHEDULED' => $byCustomer
                ? [
                    'subject' => "We received your new date: {$short}", 'badge' => 'Date change requested', 'color' => '#9333ea',
                    'headline' => 'New date requested',
                    'message' => "We've received your request to move your cleaning to <strong>{$date}</strong>. Our team will check availability and confirm by email within one business day.",
                    'actions' => ['cancel'],
                ]
                : [
                    'subject' => "Your appointment moved to {$short}", 'badge' => 'Rescheduled', 'color' => '#9333ea',
                    'headline' => 'New date for your cleaning',
                    'message' => "Your appointment has been moved to <strong>{$date}</strong>." . ($hasPrice ? ' Please confirm the new date below, or choose another one.' : ' We will send you a price quote shortly.'),
                    'actions' => $hasPrice ? ['confirm', 'reschedule', 'cancel'] : ['reschedule', 'cancel'],
                ],
            'ON_THE_WAY' => [
                'subject' => 'Your cleaner is on the way', 'badge' => 'On the way', 'color' => '#d97706',
                'headline' => 'Your cleaner is on the way',
                'message' => 'Our team is heading to your address now and will arrive shortly. Please make sure we can get in (door code, key, parking or building access).',
                'actions' => [],
            ],
            'INITIATED' => [
                'subject' => 'Your cleaning has started', 'badge' => 'In progress', 'color' => '#1d4ed8',
                'headline' => 'Your cleaning has started',
                'message' => "Our team has arrived and started your service. We'll let you know as soon as it's finished.",
                'actions' => [],
            ],
            'COMPLETED' => [
                'subject' => 'Your cleaning is complete: how did we do?', 'badge' => 'Completed', 'color' => '#059669',
                'headline' => 'Service completed',
                'message' => "Your cleaning is complete. Thank you for trusting Luxuria Pure! If anything isn't right, reply to this email within <strong>24 hours</strong> (photos help) and we'll come back to re-clean that area at no cost. We'd love to hear your feedback.",
                'actions' => ['feedback'],
            ],
            'CANCELLED' => $byCustomer
                ? [
                    'subject' => "Cancellation confirmed for {$short}", 'badge' => 'Cancelled', 'color' => '#b91c1c',
                    'headline' => 'Cancellation confirmed',
                    'message' => "As you requested, your reservation for <strong>{$date}</strong> has been cancelled. Any applicable fee follows our {$policy}. Want another date? Just reply to this email.",
                    'actions' => [],
                ]
                : [
                    'subject' => "Your cleaning on {$short} has been cancelled", 'badge' => 'Cancelled', 'color' => '#b91c1c',
                    'headline' => 'Reservation cancelled',
                    'message' => "Your reservation for <strong>{$date}</strong> has been cancelled. If you did not expect this or want to book another date, reply to this email or write to {$bookings}.",
                    'actions' => [],
                ],
            'REJECTED' => [
                'subject' => "We can't take your booking for {$short}", 'badge' => 'Not available', 'color' => '#b91c1c',
                'headline' => 'We are unable to take this booking',
                'message' => "Unfortunately we can't accommodate this request (the date may be fully booked or the address may be outside our service area). You have not been charged. Reply to this email and we'll gladly suggest another option.",
                'actions' => [],
            ],
            'REMINDER' => self::reminderCopy($date, (int)($ctx['days_left'] ?? 3), $policy),
            default => [
                'subject' => 'Update on your reservation', 'badge' => str_replace('_', ' ', $status), 'color' => '#0f172a',
                'headline' => 'Reservation update',
                'message' => 'There is an update on your reservation. Please review the details below.',
                'actions' => [],
            ],
        };

        if ($updated && !$byCustomer && in_array($status, ['CONFIRMED', 'RESCHEDULED'], true)) {
            $copy['subject'] = "Updated details for your cleaning on {$short}";
            $copy['badge'] = 'Updated';
            $copy['message'] = "We've updated the details of your appointment. Please review them below. " . $copy['message'];
        }

        return $copy;
    }

    private static function reminderCopy(string $date, int $daysLeft, string $policy): array
    {
        if ($daysLeft <= 1) {
            return [
                'subject' => 'See you tomorrow: cleaning reminder', 'badge' => 'Tomorrow', 'color' => '#0f172a',
                'headline' => 'Your cleaning is tomorrow',
                'message' => "Your cleaning is scheduled for <strong>{$date}</strong>. Please make sure our team can access the property and that pets are secured. Changes made now are within 48 hours of the service and may have a fee under our {$policy}; reply to this email if you need help.",
                'actions' => [],
            ];
        }
        return [
            'subject' => "Reminder: your cleaning is in {$daysLeft} days", 'badge' => 'Reminder', 'color' => '#0f172a',
            'headline' => 'Upcoming cleaning reminder',
            'message' => "This is a friendly reminder that your cleaning is scheduled for <strong>{$date}</strong>. Need to change it? You can reschedule or cancel for free until 48 hours before the service.",
            'actions' => ['reschedule', 'cancel'],
        ];
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
            $mail->Subject = $subject;
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

    private static function rows(array $res, bool $withPrice = true): array
    {
        $price = (float)($res['total_price'] ?? 0);
        $time = !empty($res['preferred_time']) ? date('g:i A', strtotime((string)$res['preferred_time'])) : 'To be confirmed';

        $rows = [
            'Reservation'     => self::ref($res),
            'Service'         => (string)($res['service_name'] ?? 'Cleaning service'),
            'Date & time'     => self::date($res) . ' at ' . $time,
            'Home'            => ($res['bedrooms'] ?? '-') . ' bed / ' . ($res['bathrooms'] ?? '-') . ' bath',
            'Frequency'       => (string)($res['frequency'] ?? 'One-time'),
            'Address'         => (string)($res['service_address'] ?? ''),
            'Instructions'    => trim((string)($res['special_instructions'] ?? '')) ?: 'None',
            'Total'           => $price > 0 ? '$' . number_format($price, 2) : 'Quote pending',
        ];
        if (!$withPrice) {
            unset($rows['Total']);
        }
        return $rows;
    }

    private static function detailsTable(array $res, bool $withPrice = true): string
    {
        $html = "<div style='background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 20px;margin-bottom:20px'><table style='width:100%;border-collapse:collapse'>";
        foreach (self::rows($res, $withPrice) as $label => $value) {
            $isTotal = $label === 'Total';
            $html .= "<tr><td style='padding:10px 0;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:600;vertical-align:top'>" . self::e($label) . "</td>
                <td style='padding:10px 0 10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-size:14px;font-weight:600;color:" . ($isTotal ? '#b8912a' : '#0f172a') . "'>" . nl2br(self::e($value)) . '</td></tr>';
        }
        return $html . '</table></div>';
    }

    private static function detailsText(array $res, bool $withPrice = true): string
    {
        $out = '';
        foreach (self::rows($res, $withPrice) as $label => $value) {
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

    private static function shortDate(array $res): string
    {
        return !empty($res['service_date']) ? date('D, M j', strtotime((string)$res['service_date'])) : 'your requested date';
    }

    private static function e(string $s): string
    {
        return htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
    }
}
