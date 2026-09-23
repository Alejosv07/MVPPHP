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
        $services = $this->db->query($sql)->fetchAll(PDO::FETCH_ASSOC);

        foreach ($services as &$service) {
            $service['features'] = $this->getFeaturesByService((int)$service['id']);
        }

        return $services;
    }

    public function getById(int $id): array|false {
        $stmt = $this->db->prepare("
            SELECT s.*, c.name as category_name 
            FROM services s 
            JOIN service_categories c ON s.category_id = c.id 
            WHERE s.id = ?
        ");
        $stmt->execute([$id]);
        $service = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($service) {
            $service['features'] = $this->getFeaturesByService($id);
        }

        return $service;
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

    public function getFeaturesByService(int $serviceId): array {
        $stmt = $this->db->prepare("
            SELECT f.id, f.name 
            FROM features f 
            JOIN service_feature_relations sfr ON f.id = sfr.feature_id 
            WHERE sfr.service_id = ?
        ");
        $stmt->execute([$serviceId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}