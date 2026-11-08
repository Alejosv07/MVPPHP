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

    public function customerExists(string $email): bool
    {
        $stmt = $this->db->prepare('SELECT 1 FROM customers WHERE LOWER(TRIM(email)) = :email LIMIT 1');
        $stmt->execute([':email' => $email]);
        return (bool)$stmt->fetchColumn();
    }

    public function saveOtpCode(string $email, string $code): bool
    {
        $stmt = $this->db->prepare('UPDATE customers SET otp_code = :code, otp_expires_at = DATE_ADD(NOW(), INTERVAL 10 MINUTE) WHERE LOWER(TRIM(email)) = :email');
        return $stmt->execute([':code' => $code, ':email' => $email]);
    }

    /**
     * @return array{customer_ids: int[], reservations: array}|null
     */
    public function verifyOtpAndGetReservations(string $email, string $code): ?array
    {
        $stmt = $this->db->prepare('
            SELECT id FROM customers
            WHERE LOWER(TRIM(email)) = :email
              AND otp_code = :code
              AND otp_expires_at IS NOT NULL
              AND otp_expires_at > NOW()
        ');
        $stmt->execute([':email' => $email, ':code' => $code]);
        $customerIds = array_map('intval', array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'id'));

        if (empty($customerIds)) {
            return null;
        }

        $placeholders = implode(',', array_fill(0, count($customerIds), '?'));

        // One-time use
        $this->db->prepare("UPDATE customers SET otp_code = NULL, otp_expires_at = NULL WHERE id IN ($placeholders)")
            ->execute($customerIds);

        $resStmt = $this->db->prepare("
            SELECT r.id, r.service_date, r.preferred_time, r.service_address, r.status,
                   r.total_price, r.frequency, r.bedrooms, r.bathrooms,
                   s.name AS service_name, rr.customer_rating, rr.customer_notes
            FROM reservations r
            LEFT JOIN services s ON r.service_id = s.id
            LEFT JOIN reservation_ratings rr ON r.id = rr.reservation_id
            WHERE r.customer_id IN ($placeholders)
            ORDER BY r.service_date DESC
        ");
        $resStmt->execute($customerIds);

        return [
            'customer_ids' => $customerIds,
            'reservations' => $resStmt->fetchAll(PDO::FETCH_ASSOC) ?: [],
        ];
    }
}
