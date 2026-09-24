<?php

declare(strict_types=1);

namespace App\Utils;

require_once __DIR__ . '/../Libs/PHPMailer/src/Exception.php';
require_once __DIR__ . '/../Libs/PHPMailer/src/PHPMailer.php';
require_once __DIR__ . '/../Libs/PHPMailer/src/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

class EmailService
{
    public static function sendStatusUpdateEmail(array $reservation, string $newStatus): bool
    {
        $mail = new PHPMailer(true);

        try {
            $mail->isSMTP();
            $mail->Host       = 'smtp.gmail.com';
            $mail->SMTPAuth   = true;
            $mail->Username   = 'balrking072@gmail.com';
            $mail->Password   = 'tzxyzvbbewjctwjy';
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
            $mail->Port       = 587;
            $mail->CharSet    = 'UTF-8';

            $mail->setFrom('balrking072@gmail.com', 'Luxuria Pure Cleaning Services');

            $customerName = trim(($reservation['first_name'] ?? '') . ' ' . ($reservation['last_name'] ?? ''));
            if (empty($customerName)) {
                $customerName = $reservation['customer_name'] ?? 'Valued Customer';
            }

            $recipientEmail = !empty($reservation['email']) ? $reservation['email'] : 'balrking07@gmail.com';
            $mail->addAddress($recipientEmail, $customerName);

            $resId = '#RES-' . str_pad((string)$reservation['id'], 4, '0', STR_PAD_LEFT);

            $mail->isHTML(true);
            $mail->Subject = "Reservation Update {$resId} - Luxuria Pure";
            $mail->Body    = self::buildHtmlTemplate($reservation, $newStatus, $customerName, $resId, $recipientEmail);

            return $mail->send();
        } catch (Exception $e) {
            error_log("Error sending email: {$mail->ErrorInfo}");
            return false;
        }
    }

    public static function sendPasswordResetEmail(array $user, string $code): bool
    {
        $mail = new PHPMailer(true);

        try {
            $mail->isSMTP();
            $mail->Host       = 'smtp.gmail.com';
            $mail->SMTPAuth   = true;
            $mail->Username   = 'balrking072@gmail.com';
            $mail->Password   = 'tzxyzvbbewjctwjy';
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
            $mail->Port       = 587;
            $mail->CharSet    = 'UTF-8';

            $mail->setFrom('balrking072@gmail.com', 'Luxuria Pure Cleaning Services');

            $userName = $user['name'] ?? 'User';
            $recipientEmail = $user['email'];

            $mail->addAddress($recipientEmail, $userName);

            $mail->isHTML(true);
            $mail->Subject = "Password Reset Code - Luxuria Pure";
            $mail->Body    = self::buildPasswordResetTemplate($userName, $code);

            return $mail->send();
        } catch (Exception $e) {
            error_log("Error sending password reset email: {$mail->ErrorInfo}");
            return false;
        }
    }

    private static function buildPasswordResetTemplate(string $userName, string $code): string
    {
        return "
        <!DOCTYPE html>
        <html lang='en'>
        <head>
            <meta charset='UTF-8'>
            <title>Password Reset</title>
            <style>
                body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #fcfbf9; margin: 0; padding: 40px 15px; color: #0f172a; }
                .wrapper { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #d9d2c9; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03); }
                .brand-header { background-color: #0f172a; padding: 32px 20px; text-align: center; }
                .brand-header h1 { font-family: Georgia, serif; color: #d4af37; margin: 0; font-size: 28px; font-weight: normal; letter-spacing: -0.025em; text-transform: uppercase; }
                .content { padding: 40px 32px; }
                .greeting { font-family: Georgia, serif; font-size: 22px; font-weight: normal; margin: 0 0 12px 0; color: #0f172a; letter-spacing: -0.025em; }
                .message { font-size: 15px; line-height: 1.6; color: #475569; margin: 0 0 28px 0; }
                .code-box { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 28px; }
                .code-text { font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #d4af37; font-family: monospace; }
                .footer { background-color: #f1f5f9; padding: 24px 32px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; }
            </style>
        </head>
        <body>
            <div class='wrapper'>
                <div class='brand-header'>
                    <h1>Luxuria Pure</h1>
                </div>
                <div class='content'>
                    <h2 class='greeting'>Hello, {$userName}</h2>
                    <p class='message'>
                        You have requested to reset your password for Luxuria Pure. Below is your temporary verification code, which is valid for 15 minutes:
                    </p>
                    <div class='code-box'>
                        <div style='font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 8px; font-weight: 600;'>Your recovery code is</div>
                        <div class='code-text'>{$code}</div>
                    </div>
                    <p style='font-size: 13px; color: #475569; line-height: 1.5; text-align: center;'>
                        If you did not request this change, you can safely ignore this message.
                    </p>
                </div>
                <div class='footer'>
                    &copy; " . date('Y') . " Luxuria Pure Cleaning Services. All rights reserved.
                </div>
            </div>
        </body>
        </html>
        ";
    }

    private static function buildHtmlTemplate(array $res, string $status, string $customerName, string $resId, string $recipientEmail): string
    {
        $statusColors = [
            'PENDING'     => '#b45309',
            'INITIATED'   => '#1d4ed8',
            'ON_THE_WAY'  => '#d97706',
            'RESCHEDULED' => '#9333ea',
            'COMPLETED'   => '#059669',
            'CANCELLED'   => '#b91c1c',
            'REJECTED'    => '#b91c1c'
        ];

        $badgeColor = $statusColors[$status] ?? '#0f172a';

        $formattedDate = !empty($res['service_date']) ? date('F j, Y', strtotime($res['service_date'])) : 'N/A';
        $formattedTime = !empty($res['preferred_time']) ? date('g:i A', strtotime($res['preferred_time'])) : '09:00 AM';
        $serviceName   = $res['service_name'] ?? 'Standard Cleaning Service';
        $address       = $res['service_address'] ?? 'Address registered in system';

        $bedrooms      = isset($res['bedrooms']) ? $res['bedrooms'] . ' Bedroom(s)' : 'N/A';
        $bathrooms     = isset($res['bathrooms']) ? $res['bathrooms'] . ' Bathroom(s)' : 'N/A';
        $frequency     = $res['frequency'] ?? 'One-time';

        $rawPrice = isset($res['total_price']) ? (float)$res['total_price'] : 0.00;
        $totalPrice = $rawPrice > 0 ? '$' . number_format($rawPrice, 2) : 'Pending Review / Awaiting Quote';

        $instructions  = !empty($res['special_instructions']) ? htmlspecialchars($res['special_instructions']) : 'None specified';

        $assignedStaff = $res['staff_name'] ?? null;
        $staffNoticeHtml = "";
        
        if (!empty($assignedStaff)) {
            $staffNoticeHtml = "
            <div style='background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin-bottom: 24px;'>
                <p style='margin: 0; font-size: 14px; color: #166534;'>
                    <strong>✨ Assigned Staff:</strong> <strong>" . htmlspecialchars($assignedStaff) . "</strong> has been assigned to perform this cleaning service at your location.
                </p>
            </div>";
        }

        $secret = 'purenest_secret';
        $token = hash('sha256', $res['id'] . 'balrking07@gmail.com' . $secret);

        $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
        if (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https') {
            $protocol = 'https';
        }
        $host = $_SERVER['HTTP_HOST'] ?? 'localhost';

        $baseUrl = "{$protocol}://{$host}/api/public/reservations?id={$res['id']}&token={$token}";

        $confirmUrl    = "{$baseUrl}&action=confirm";
        $rescheduleUrl = "{$baseUrl}&action=reschedule";
        $cancelUrl     = "{$baseUrl}&action=cancel";

        $actionButtonsHtml = "";

        if (!in_array($status, ['CANCELLED', 'REJECTED'], true)) {
            $actionButtonsHtml = "
            <div style='text-align: center; margin: 32px 0 16px 0;'>
                <a href='{$confirmUrl}' style='background-color: #0f172a; color: #ffffff; padding: 12px 18px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 13px; margin-right: 5px; display: inline-block;'>
                    Confirm
                </a>
                <a href='{$rescheduleUrl}' style='background-color: #9333ea; color: #ffffff; padding: 12px 18px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 13px; margin-right: 5px; display: inline-block;'>
                    Reschedule
                </a>
                <a href='{$cancelUrl}' style='background-color: #b91c1c; color: #ffffff; padding: 12px 18px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 13px; display: inline-block;'>
                    Cancel
                </a>
            </div>";
        }

        return "
        <!DOCTYPE html>
        <html lang='en'>
        <head>
            <meta charset='UTF-8'>
            <meta name='viewport' content='width=device-width, initial-scale=1.0'>
            <title>Reservation Update - Luxuria Pure</title>
            <style>
                body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f8f9fa; margin: 0; padding: 40px 15px; color: #0f172a; }
                .wrapper { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03); }
                .brand-header { background-color: #0f172a; padding: 36px 20px; text-align: center; }
                .brand-header h1 { font-family: Georgia, serif; color: #d4af37; margin: 0; font-size: 36px; font-weight: normal; letter-spacing: -0.025em; text-transform: uppercase; }
                .content { padding: 40px 32px; }
                .status-badge { display: inline-block; padding: 6px 16px; border-radius: 50px; color: #ffffff; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; background-color: {$badgeColor}; margin-bottom: 24px; }
                .greeting { font-family: Georgia, serif; font-size: 24px; font-weight: normal; margin: 0 0 12px 0; color: #0f172a; letter-spacing: -0.025em; }
                .message { font-size: 15px; line-height: 1.6; color: #475569; margin: 0 0 28px 0; }
                .details-card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; margin-bottom: 20px; }
                .details-table { width: 100%; border-collapse: collapse; }
                .details-table td { padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
                .details-table tr:last-child td { border-bottom: none; }
                .label { color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
                .value { color: #0f172a; font-weight: 600; text-align: right; }
                .footer { background-color: #f1f5f9; padding: 24px 32px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; }
                .text-navy { color: #0f172a; }
                .text-gold { color: #d4af37; }
            </style>
        </head>
        <body>
            <div class='wrapper'>
                <div class='brand-header'>
                    <h1 class='font-serif text-4xl tracking-tight text-gold'>Luxuria Pure</h1>
                </div>

                <div class='content'>
                    <span class='status-badge'>{$status}</span>
                    
                    <h2 class='greeting font-serif text-4xl tracking-tight text-navy'>Hello {$customerName},</h2>
                    <p class='message'>
                        The status of your cleaning reservation has been updated. Please review the comprehensive details of your scheduled service below:
                    </p>

                    {$staffNoticeHtml}

                    <div class='details-card'>
                        <table class='details-table'>
                            <tr>
                                <td class='label'>Reservation ID</td>
                                <td class='value text-navy'>{$resId}</td>
                            </tr>
                            <tr>
                                <td class='label'>Service</td>
                                <td class='value text-navy'>{$serviceName}</td>
                            </tr>
                            <tr>
                                <td class='label'>Date & Time</td>
                                <td class='value text-navy'>{$formattedDate} at {$formattedTime}</td>
                            </tr>
                            <tr>
                                <td class='label'>Bedrooms / Bathrooms</td>
                                <td class='value text-navy'>{$bedrooms} / {$bathrooms}</td>
                            </tr>
                            <tr>
                                <td class='label'>Frequency</td>
                                <td class='value text-navy'>{$frequency}</td>
                            </tr>
                            <tr>
                                <td class='label'>Address</td>
                                <td class='value text-navy'>{$address}</td>
                            </tr>
                            <tr>
                                <td class='label'>Special Instructions</td>
                                <td class='value text-navy'>{$instructions}</td>
                            </tr>
                            <tr>
                                <td class='label' style='font-size: 13px;'>Total Price</td>
                                <td class='value text-gold' style='font-size: 15px; font-weight: bold;'>{$totalPrice}</td>
                            </tr>
                        </table>
                    </div>

                    {$actionButtonsHtml}

                    <p style='font-size: 13px; color: #64748b; margin-top: 20px; line-height: 1.5; text-align: center;'>
                        If you need to make further adjustments, please contact our support team.
                    </p>
                </div>

                <div class='footer'>
                    &copy; " . date('Y') . " Luxuria Pure Cleaning Services. All rights reserved.
                </div>
            </div>
        </body>
        </html>
        ";
    }

    public static function sendOtpEmail(string $recipientEmail, string $code): bool
    {
        $mail = new PHPMailer(true);

        try {
            $mail->isSMTP();
            $mail->Host       = 'smtp.gmail.com';
            $mail->SMTPAuth   = true;
            $mail->Username   = 'balrking072@gmail.com';
            $mail->Password   = 'tzxyzvbbewjctwjy';
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
            $mail->Port       = 587;
            $mail->CharSet    = 'UTF-8';

            $mail->setFrom('balrking072@gmail.com', 'Luxuria Pure Cleaning Services');
            $mail->addAddress($recipientEmail, 'Valued Customer');

            $mail->isHTML(true);
            $mail->Subject = "Your Security Verification PIN - Luxuria Pure";
            $mail->Body    = self::buildOtpTemplate($code);

            return $mail->send();
        } catch (Exception $e) {
            error_log("Error sending OTP email: {$mail->ErrorInfo}");
            return false;
        }
    }

    private static function buildOtpTemplate(string $code): string
    {
        return "
        <!DOCTYPE html>
        <html lang='en'>
        <head>
            <meta charset='UTF-8'>
            <title>Security Verification PIN</title>
            <style>
                body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #fcfbf9; margin: 0; padding: 40px 15px; color: #0f172a; }
                .wrapper { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #d9d2c9; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03); }
                .brand-header { background-color: #0f172a; padding: 32px 20px; text-align: center; }
                .brand-header h1 { font-family: Georgia, serif; color: #d4af37; margin: 0; font-size: 28px; font-weight: normal; letter-spacing: -0.025em; text-transform: uppercase; }
                .content { padding: 40px 32px; }
                .greeting { font-family: Georgia, serif; font-size: 22px; font-weight: normal; margin: 0 0 12px 0; color: #0f172a; }
                .message { font-size: 15px; line-height: 1.6; color: #475569; margin: 0 0 28px 0; }
                .code-box { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 28px; }
                .code-text { font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #d4af37; font-family: monospace; }
                .footer { background-color: #f1f5f9; padding: 24px 32px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; }
            </style>
        </head>
        <body>
            <div class='wrapper'>
                <div class='brand-header'>
                    <h1>Luxuria Pure</h1>
                </div>
                <div class='content'>
                    <h2 class='greeting'>Hello,</h2>
                    <p class='message'>
                        You have requested to securely view your booking history and submit feedback. Below is your 4-digit verification PIN, valid for 10 minutes:
                    </p>
                    <div class='code-box'>
                        <div style='font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 8px; font-weight: 600;'>Your Security PIN</div>
                        <div class='code-text'>{$code}</div>
                    </div>
                    <p style='font-size: 13px; color: #475569; line-height: 1.5; text-align: center;'>
                        If you did not request this code, you can safely ignore this message.
                    </p>
                </div>
                <div class='footer'>
                    &copy; " . date('Y') . " Luxuria Pure Cleaning Services. All rights reserved.
                </div>
            </div>
        </body>
        </html>
        ";
    }
}