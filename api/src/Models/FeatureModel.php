<?php
declare(strict_types=1);

namespace App\Models;

use App\Config\Database;
use PDO;

class FeatureModel {
    private PDO $db;

    public function __construct() {
        $this->db = (new Database())->getConnection();
    }

    public function getAll(): array {
        $stmt = $this->db->query("SELECT * FROM features ORDER BY name ASC");
        return $stmt->fetchAll();
    }

    public function getById(int $id): array|false {
        $stmt = $this->db->prepare("SELECT * FROM features WHERE id = ?");
        $stmt->execute([$id]);
        return $stmt->fetch();
    }

    public function create(string $name): int {
        $stmt = $this->db->prepare("INSERT INTO features (name) VALUES (?)");
        $stmt->execute([$name]);
        return (int)$this->db->lastInsertId();
    }

    public function update(int $id, string $name): bool {
        $stmt = $this->db->prepare("UPDATE features SET name = ? WHERE id = ?");
        return $stmt->execute([$name, $id]);
    }

    public function delete(int $id): bool {
        $stmt = $this->db->prepare("DELETE FROM features WHERE id = ?");
        return $stmt->execute([$id]);
    }
}