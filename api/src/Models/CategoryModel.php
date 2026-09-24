<?php
declare(strict_types=1);

namespace App\Models;

use App\Config\Database;
use PDO;

class CategoryModel {
    private PDO $db;

    public function __construct() {
        $this->db = (new Database())->getConnection();
    }

public function getAll(): array {
    return [
        [
            'id' => 999,
            'name' => 'TEST CATEGORY',
            'description' => 'TEST'
        ]
    ];
}

    public function getById(int $id): array|false {
        $stmt = $this->db->prepare("SELECT * FROM service_categories WHERE id = ?");
        $stmt->execute([$id]);
        return $stmt->fetch();
    }

    public function create(string $name, ?string $description = null): int {
        $stmt = $this->db->prepare("INSERT INTO service_categories (name, description) VALUES (?, ?)");
        $stmt->execute([$name, $description]);
        return (int)$this->db->lastInsertId();
    }

    public function update(int $id, string $name, ?string $description = null): bool {
        $stmt = $this->db->prepare("UPDATE service_categories SET name = ?, description = ? WHERE id = ?");
        return $stmt->execute([$name, $description, $id]);
    }

    public function delete(int $id): bool {
        $stmt = $this->db->prepare("DELETE FROM service_categories WHERE id = ?");
        return $stmt->execute([$id]);
    }
}