<?php

declare(strict_types=1);

namespace App\Models;

use App\Config\Database;
use PDO;
use Exception;

class AuditModel {
    private PDO $db;

    public function __construct() {
        $this->db = (new Database())->getConnection();
    }

    /**
     * Registra una acción de auditoría en la tabla activity_logs
     */
    public function log(?int $userId, string $action, string $entityType, int $entityId, ?string $details, ?string $ipAddress): bool {
        try {
            $stmt = $this->db->prepare("
                INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, ip_address)
                VALUES (:user_id, :action, :entity_type, :entity_id, :details, :ip_address)
            ");
            
            return $stmt->execute([
                ':user_id'     => $userId,
                ':action'      => $action,
                ':entity_type' => $entityType,
                ':entity_id'   => $entityId,
                ':details'     => $details,
                ':ip_address'  => $ipAddress
            ]);
        } catch (Exception $e) {
            error_log("Audit logging error: " . $e->getMessage());
            return false;
        }
    }

    public function getLogs(): array {
        $sql = "SELECT l.*, u.name as user_name, u.email as user_email 
                FROM activity_logs l 
                LEFT JOIN users u ON l.user_id = u.id 
                ORDER BY l.created_at DESC 
                LIMIT 100";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getReservationHistory(): array {
        $sql = "SELECT h.*, u.name as user_name, r.service_date 
                FROM reservation_history h 
                LEFT JOIN users u ON h.user_id = u.id 
                LEFT JOIN reservations r ON h.reservation_id = r.id 
                ORDER BY h.created_at DESC 
                LIMIT 100";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}