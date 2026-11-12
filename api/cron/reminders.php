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
    WHERE r.status IN ('CONFIRMED', 'RESCHEDULED')
      AND r.service_date IN (DATE_ADD(CURDATE(), INTERVAL 3 DAY), DATE_ADD(CURDATE(), INTERVAL 1 DAY))
";

$reservations = $db->query($sql)->fetchAll(PDO::FETCH_ASSOC);
$sent = 0;

$today = new DateTimeImmutable('today');
foreach ($reservations as $res) {
    $daysLeft = (int)$today->diff(new DateTimeImmutable((string)$res['service_date']))->days;
    if (EmailService::sendStatusUpdateEmail($res, 'REMINDER', ['days_left' => $daysLeft])) {
        $sent++;
    }
}

echo "Reminders processed: " . count($reservations) . ", sent: {$sent}\n";
