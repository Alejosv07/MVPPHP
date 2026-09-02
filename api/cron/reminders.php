<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/Database.php';
require_once __DIR__ . '/../src/Utils/EmailService.php';

use App\Config\Database;
use App\Utils\EmailService;

$db = (new Database())->getConnection();

$sql = "
    SELECT r.*, c.email, c.first_name, c.last_name, s.name as service_name 
    FROM reservations r
    JOIN customers c ON r.customer_id = c.id
    JOIN services s ON r.service_id = s.id
    WHERE r.status = 'CONFIRMED' 
    AND (
        r.service_date = DATE_ADD(CURDATE(), INTERVAL 7 DAY)
        OR r.service_date = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
    )
";

$stmt = $db->query($sql);
$reservations = $stmt->fetchAll(PDO::FETCH_ASSOC);

foreach ($reservations as $res) {
    EmailService::sendStatusUpdateEmail($res, 'REMINDER: Upcoming Cleaning');
}

echo "Reminders executed successfully. Processed: " . count($reservations) . " emails.\n";