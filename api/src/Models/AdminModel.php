<?php
declare(strict_types=1);

namespace App\Models;

use App\Config\Database;
use PDO;

class AdminModel
{
    private PDO $db;

    public function __construct()
    {
        $this->db = (new Database())->getConnection();
    }

    public function getAll(): array
    {
        $stmt = $this->db->query("SELECT id, name, email, role, reset_code, reset_expires_at, is_active, created_at, updated_at FROM users ORDER BY created_at DESC");
        return $stmt->fetchAll();
    }

    public function getById(int $id): ?array
    {
        $stmt = $this->db->prepare("SELECT id, name, email, role, reset_code, reset_expires_at, is_active, created_at, updated_at FROM users WHERE id = ?");
        $stmt->execute([$id]);
        $user = $stmt->fetch();
        return $user ?: null;
    }

    public function create(array $data): int
    {
        $stmt = $this->db->prepare("INSERT INTO users (name, email, password, role, is_active) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([
            $data['name'],
            $data['email'],
            password_hash($data['password'], PASSWORD_DEFAULT),
            $data['role'] ?? 'ADMIN',
            isset($data['is_active']) ? (int)$data['is_active'] : 1
        ]);

        return (int)$this->db->lastInsertId();
    }

    public function update(int $id, array $data): bool
    {
        $fields = [];
        $values = [];

        if (isset($data['name'])) { $fields[] = "name = ?"; $values[] = $data['name']; }
        if (isset($data['email'])) { $fields[] = "email = ?"; $values[] = $data['email']; }
        if (isset($data['role'])) { $fields[] = "role = ?"; $values[] = $data['role']; }
        if (isset($data['is_active'])) { $fields[] = "is_active = ?"; $values[] = (int)$data['is_active']; }
        
        if (!empty($data['password'])) { 
            $fields[] = "password = ?"; 
            $values[] = password_hash($data['password'], PASSWORD_DEFAULT); 
        }

        if (isset($data['reset_code'])) { 
            $fields[] = "reset_code = ?"; 
            $values[] = $data['reset_code']; 
            $fields[] = "reset_expires_at = DATE_ADD(NOW(), INTERVAL 15 MINUTE)";
        }

        if (empty($fields)) {
            return false;
        }

        $values[] = $id;
        $sql = "UPDATE users SET " . implode(", ", $fields) . " WHERE id = ?";
        $stmt = $this->db->prepare($sql);
        
        return $stmt->execute($values);
    }

    public function delete(int $id): bool
    {
        $stmt = $this->db->prepare("DELETE FROM users WHERE id = ?");
        return $stmt->execute([$id]);
    }
}