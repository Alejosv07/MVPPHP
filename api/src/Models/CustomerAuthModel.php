<?php

declare(strict_types=1);

namespace App\Models;

use App\Config\Database;
use PDO;

class CustomerAuthModel
{
    private PDO $db;

    public function __construct()
    {
        $this->db = (new Database())->getConnection();
    }

    public function saveOtpCode(string $email, string $code): bool
    {
        $stmt = $this->db->prepare("UPDATE customers SET otp_code = :code, otp_expires_at = DATE_ADD(NOW(), INTERVAL 10 MINUTE) WHERE email = :email");
        return $stmt->execute([':code' => $code, ':email' => $email]);
    }

    public function verifyOtpAndGetReservations(string $email, string $code): ?array
    {
        $cleanEmail = trim(strtolower($email));
        $cleanCode = trim($code);

        $stmt = $this->db->prepare("SELECT id FROM customers WHERE LOWER(TRIM(email)) = :email AND otp_code = :code");
        $stmt->execute([':email' => $cleanEmail, ':code' => $cleanCode]);
        $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (empty($customers)) {
            error_log("OTP Auth Debug: No customer found for email '{$cleanEmail}' with code '{$cleanCode}'");
            return null;
        }

        $customerIds = array_column($customers, 'id');

        $inParams = [];
        $placeholders = [];
        foreach ($customerIds as $index => $id) {
            $key = ":id_{$index}";
            $placeholders[] = $key;
            $inParams[$key] = $id;
        }

        $placeholdersStr = implode(',', $placeholders);
        $clearStmt = $this->db->prepare("UPDATE customers SET otp_code = NULL, otp_expires_at = NULL WHERE id IN ($placeholdersStr)");
        $clearStmt->execute($inParams);

        $inClause = implode(',', $customerIds);
        $resStmt = $this->db->prepare("
            SELECT r.*, s.name AS service_name 
            FROM reservations r 
            LEFT JOIN services s ON r.service_id = s.id 
            WHERE r.customer_id IN ({$inClause})
            ORDER BY r.service_date DESC
        ");

        $resStmt->execute();
        $reservations = $resStmt->fetchAll(PDO::FETCH_ASSOC);

        error_log("OTP Auth Debug: Found " . count($reservations) . " reservations for customer IDs: " . implode(', ', $customerIds));

        return $reservations ?: [];
    }
}
