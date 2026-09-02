<?php
declare(strict_types=1);

namespace App\Utils;

require_once __DIR__ . '/../Libs/PHPMailer/src/Exception.php';
require_once __DIR__ . '/../Libs/PHPMailer/src/PHPMailer.php';
require_once __DIR__ . '/../Libs/PHPMailer/src/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

class EmailService {

    public static function sendStatusUpdateEmail(array $reservation, string $newStatus): bool {
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

            $mail->setFrom('balrking072@gmail.com', 'PureNest Cleaning Services');

            $customerName = trim(($reservation['first_name'] ?? '') . ' ' . ($reservation['last_name'] ?? ''));
            if (empty($customerName)) {
                $customerName = $reservation['customer_name'] ?? 'Valued Customer';
            }

            $recipientEmail = !empty($reservation['email']) ? $reservation['email'] : 'balrking07@gmail.com';
            $mail->addAddress($recipientEmail, $customerName);

            $resId = '#RES-' . str_pad((string)$reservation['id'], 4, '0', STR_PAD_LEFT);

            $mail->isHTML(true);
            $mail->Subject = "Reservation Update {$resId} - PureNest";
            $mail->Body    = self::buildHtmlTemplate($reservation, $newStatus, $customerName, $resId, $recipientEmail);

            return $mail->send();
        } catch (Exception $e) {
            error_log("Error sending email: {$mail->ErrorInfo}");
            return false;
        }
    }

    private static function buildHtmlTemplate(array $res, string $status, string $customerName, string $resId, string $recipientEmail): string {
        $statusColors = [
            'CONFIRMED' => '#1b3022',
            'PENDING'   => '#b45309',
            'CANCELLED' => '#b91c1c',
            'REJECTED'  => '#4b5563',
            'COMPLETED' => '#059669'
        ];

        $badgeColor = $statusColors[$status] ?? '#1b3022';

        $formattedDate = !empty($res['service_date']) ? date('F j, Y', strtotime($res['service_date'])) : 'N/A';
        $formattedTime = !empty($res['preferred_time']) ? date('g:i A', strtotime($res['preferred_time'])) : '09:00 AM';
        $serviceName   = $res['service_name'] ?? 'Standard Cleaning Service';
        $address       = $res['service_address'] ?? 'Address registered in system';

        $secret = 'purenest_secret';
        $token = hash('sha256', $res['id'] . 'balrking07@gmail.com' . $secret);
        
       $baseUrl = "http://localhost/purenest/api/public/reservations?id={$res['id']}&token={$token}";

        $confirmUrl = "{$baseUrl}&action=confirm";
        $cancelUrl  = "{$baseUrl}&action=cancel";

        $actionButtonsHtml = "";

        if ($status === 'PENDING') {
            $actionButtonsHtml = "
            <div style='text-align: center; margin: 32px 0 16px 0;'>
                <a href='{$confirmUrl}' style='background-color: #1b3022; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 13px; margin-right: 10px; display: inline-block;'>
                    Confirm Service
                </a>
                <a href='{$cancelUrl}' style='background-color: #b91c1c; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 13px; display: inline-block;'>
                    Cancel Service
                </a>
            </div>";
        } elseif ($status === 'CONFIRMED') {
            $actionButtonsHtml = "
            <div style='text-align: center; margin: 32px 0 16px 0;'>
                <a href='{$cancelUrl}' style='background-color: #b91c1c; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 13px; display: inline-block;'>
                    Cancel Service
                </a>
            </div>";
        }

        return "
        <!DOCTYPE html>
        <html lang='en'>
        <head>
            <meta charset='UTF-8'>
            <meta name='viewport' content='width=device-width, initial-scale=1.0'>
            <title>Reservation Update</title>
            <style>
                body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f8f9fa; margin: 0; padding: 40px 15px; color: #1b3022; }
                .wrapper { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03); }
                .brand-header { background-color: #1b3022; padding: 32px 20px; text-align: center; }
                .brand-header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 400; letter-spacing: 3px; text-transform: uppercase; }
                .content { padding: 40px 32px; }
                .status-badge { display: inline-block; padding: 6px 16px; border-radius: 50px; color: #ffffff; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; background-color: {$badgeColor}; margin-bottom: 24px; }
                .greeting { font-size: 20px; font-weight: 600; margin: 0 0 12px 0; color: #111827; }
                .message { font-size: 15px; line-height: 1.6; color: #4b5563; margin: 0 0 28px 0; }
                .details-card { background-color: #fcfbf9; border: 1px solid #f3f0e6; border-radius: 8px; padding: 24px; margin-bottom: 20px; }
                .details-table { width: 100%; border-collapse: collapse; }
                .details-table td { padding: 10px 0; border-bottom: 1px solid #f3f0e6; font-size: 14px; }
                .details-table tr:last-child td { border-bottom: none; }
                .label { color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; }
                .value { color: #111827; font-weight: 600; text-align: right; }
                .footer { background-color: #f9fafb; padding: 24px 32px; text-align: center; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; }
            </style>
        </head>
        <body>
            <div class='wrapper'>
                <div class='brand-header'>
                    <h1>PureNest</h1>
                </div>

                <div class='content'>
                    <span class='status-badge'>{$status}</span>
                    
                    <h2 class='greeting'>Hello {$customerName},</h2>
                    <p class='message'>
                        The status of your cleaning reservation has been updated. Below are the current details of your scheduled service:
                    </p>

                    <div class='details-card'>
                        <table class='details-table'>
                            <tr>
                                <td class='label'>Reservation ID</td>
                                <td class='value'>{$resId}</td>
                            </tr>
                            <tr>
                                <td class='label'>Service</td>
                                <td class='value'>{$serviceName}</td>
                            </tr>
                            <tr>
                                <td class='label'>Date</td>
                                <td class='value'>{$formattedDate}</td>
                            </tr>
                            <tr>
                                <td class='label'>Time</td>
                                <td class='value'>{$formattedTime}</td>
                            </tr>
                            <tr>
                                <td class='label'>Address</td>
                                <td class='value'>{$address}</td>
                            </tr>
                        </table>
                    </div>

                    {$actionButtonsHtml}

                    <p style='font-size: 13px; color: #6b7280; margin-top: 20px; line-height: 1.5; text-align: center;'>
                        If you need to make further adjustments, please contact our support team.
                    </p>
                </div>

                <div class='footer'>
                    &copy; " . date('Y') . " PureNest Cleaning Services. All rights reserved.
                </div>
            </div>
        </body>
        </html>
        ";
    }
}