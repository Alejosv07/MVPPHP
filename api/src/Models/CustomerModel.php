<?php
declare(strict_types=1);

namespace App\Models;

use App\Config\Database;
use PDO;

class CustomerModel {
    private PDO $db;

    public function __construct() {
        $this->db = (new Database())->getConnection();
    }

    public function getAll(): array {
        return $this->db->query("SELECT * FROM customers ORDER BY created_at DESC")->fetchAll();
    }

    public function getById(int $id): array|false {
        $stmt = $this->db->prepare("SELECT * FROM customers WHERE id = ?");
        $stmt->execute([$id]);
        return $stmt->fetch();
    }

    public function findByEmail(string $email): array|false {
        $stmt = $this->db->prepare("SELECT * FROM customers WHERE email = ?");
        $stmt->execute([$email]);
        return $stmt->fetch();
    }

    public function create(array $data): int {
        $stmt = $this->db->prepare("
            INSERT INTO customers (first_name, last_name, email, phone_number) 
            VALUES (?, ?, ?, ?)
        ");
        $stmt->execute([
            $data['first_name'],
            $data['last_name'],
            $data['email'],
            $data['phone_number']
        ]);
        return (int)$this->db->lastInsertId();
    }
}