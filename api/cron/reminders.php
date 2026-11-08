<?php
declare(strict_types=1);

// CLI only: run from the hosting cron, e.g.  php /path/to/api/cron/reminders.php
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

// Reminder 3 days before (while free cancellation is still possible) and again the day before
$sql = "
    SELECT r.*, c.email, c.first_name, c.last_name, s.name AS service_name, u.name AS staff_name
    FROM reservations r
    JOIN customers c ON r.customer_id = c.id
    JOIN services s ON r.service_id = s.id
    LEFT JOIN users u ON r.staff_id = u.id
    WHERE r.status IN ('CONFIRMED', 'RESCHEDULED')
      AND r.service_date IN (DATE_ADD(CURDATE(), INTERVAL 3 DAY), DATE_ADD(CURDATE(), INTERVAL 1 DAY))
";

$reservations = $db->query($sql)->fetchAll(PDO::FETCH_ASSOC);
$sent = 0;

foreach ($reservations as $res) {
    if (EmailService::sendStatusUpdateEmail($res, 'REMINDER')) {
        $sent++;
    }
}

echo "Reminders processed: " . count($reservations) . ", sent: {$sent}\n";
