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
        return $this->db->query("SELECT * FROM service_categories ORDER BY name ASC")->fetchAll();
    }

    public function create(string $name): int {
        $stmt = $this->db->prepare("INSERT INTO service_categories (name) VALUES (?)");
        $stmt->execute([$name]);
        return (int)$this->db->lastInsertId();
    }
}