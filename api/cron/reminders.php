<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../src/Utils/Response.php';
require_once __DIR__ . '/../src/Utils/Auth.php';
require_once __DIR__ . '/../src/Utils/EmailService.php';

use App\Config\Database;
use App\Utils\EmailService;

$db = (new Database())->getConnection();

$sql = "
    SELECT r.*, c.email, c.first_name, c.last_name, s.name AS service_name, u.name AS staff_name, u.email AS staff_email
    FROM reservations r
    JOIN customers c ON r.customer_id = c.id
    JOIN services s ON r.service_id = s.id
    LEFT JOIN users u ON r.staff_id = u.id
    WHERE r.service_date IN (DATE_ADD(CURDATE(), INTERVAL 3 DAY), DATE_ADD(CURDATE(), INTERVAL 1 DAY))
      AND r.status IN ('PENDING', 'QUOTED', 'CONFIRMED', 'RESCHEDULED')
";

$reservations = $db->query($sql)->fetchAll(PDO::FETCH_ASSOC);
$sent = 0;
$staffSent = 0;
$alerts = 0;

$today = new DateTimeImmutable('today');
foreach ($reservations as $res) {
    $daysLeft = (int)$today->diff(new DateTimeImmutable((string)$res['service_date']))->days;
    $ref = sprintf('#RES-%04d', (int)$res['id']);

    // Only confirmed appointments get reminders; anything else is still waiting on someone
    if ($res['status'] === 'CONFIRMED') {
        if (EmailService::sendStatusUpdateEmail($res, 'REMINDER', ['days_left' => $daysLeft])) {
            $sent++;
        }
        if ($daysLeft <= 1 && !empty($res['staff_email']) && EmailService::sendStaffJobEmail($res, 'reminder')) {
            $staffSent++;
        }
    }

    // Tell the office about bookings that are close and not ready
    $problem = match (true) {
        $res['status'] === 'PENDING'     => 'still has no quote',
        $res['status'] === 'QUOTED'      => 'the customer has not accepted the quote yet',
        $res['status'] === 'RESCHEDULED' => 'the new date has not been confirmed yet',
        empty($res['staff_id'])          => 'has no cleaner assigned',
        default                          => null,
    };
    if ($problem !== null && EmailService::sendTeamAlert($res, "Needs attention: {$ref} in {$daysLeft} day(s) {$problem}")) {
        $alerts++;
    }
}

echo "Reservations checked: " . count($reservations) . ", customer reminders: {$sent}, cleaner reminders: {$staffSent}, office alerts: {$alerts}\n";
