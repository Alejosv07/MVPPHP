<?php
declare(strict_types=1);

namespace App\Models;

use App\Config\Database;
use PDO;

class ServiceModel {
    private PDO $db;

    public function __construct() {
        $this->db = (new Database())->getConnection();
    }

    public function getAll(): array {
        $sql = "SELECT s.*, c.name as category_name 
                FROM services s 
                JOIN service_categories c ON s.category_id = c.id
                ORDER BY s.created_at DESC";
        return $this->db->query($sql)->fetchAll();
    }

    public function getById(int $id): array|false {
        $stmt = $this->db->prepare("
            SELECT s.*, c.name as category_name 
            FROM services s 
            JOIN service_categories c ON s.category_id = c.id 
            WHERE s.id = ?
        ");
        $stmt->execute([$id]);
        return $stmt->fetch();
    }

    public function create(array $data): int {
        $stmt = $this->db->prepare("
            INSERT INTO services 
            (category_id, name, description, price_per_hour, estimated_duration_hours, image_url, is_active) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $data['category_id'],
            $data['name'],
            $data['description'] ?? null,
            $data['price_per_hour'],
            $data['estimated_duration_hours'],
            $data['image_url'] ?? null,
            $data['is_active'] ?? 1
        ]);
        return (int)$this->db->lastInsertId();
    }

    public function update(int $id, array $data): bool {
        $stmt = $this->db->prepare("
            UPDATE services 
            SET category_id = ?, name = ?, description = ?, price_per_hour = ?, 
                estimated_duration_hours = ?, is_active = ?, image_url = COALESCE(?, image_url)
            WHERE id = ?
        ");
        return $stmt->execute([
            $data['category_id'],
            $data['name'],
            $data['description'] ?? null,
            $data['price_per_hour'],
            $data['estimated_duration_hours'],
            $data['is_active'],
            $data['image_url'] ?? null,
            $id
        ]);
    }

    public function delete(int $id): bool {
        $stmt = $this->db->prepare("DELETE FROM services WHERE id = ?");
        return $stmt->execute([$id]);
    }
}