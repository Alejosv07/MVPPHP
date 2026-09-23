<?php

declare(strict_types=1);

namespace App\Models;

use App\Config\Database;
use PDO;

class AuthModel
{
    private PDO $db;

    public function __construct()
    {
        $this->db = (new Database())->getConnection();
    }

    public function findByEmail(string $email): ?array
    {
        $stmt = $this->db->prepare("SELECT * FROM users WHERE email = :email AND is_active = 1 LIMIT 1");
        $stmt->execute([':email' => $email]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        return $user ?: null;
    }

    public function saveResetCode(string $email, string $code): bool
    {
        $stmt = $this->db->prepare("UPDATE users SET reset_code = :code, reset_expires_at = DATE_ADD(NOW(), INTERVAL 15 MINUTE) WHERE email = :email");
        return $stmt->execute([':code' => $code, ':email' => $email]);
    }

    public function updatePasswordWithCode(string $email, string $code, string $hashedPassword): bool
    {
        $stmt = $this->db->prepare("UPDATE users SET password = :password, reset_code = NULL, reset_expires_at = NULL WHERE email = :email AND reset_code = :code AND reset_expires_at > NOW()");
        $stmt->execute([
            ':password' => $hashedPassword,
            ':email'    => $email,
            ':code'     => $code
        ]);

        return $stmt->rowCount() > 0;
    }

    public function updatePasswordByCodeOnly(string $code, string $hashedPassword): bool
    {
        $stmt = $this->db->prepare("SELECT id FROM users WHERE reset_code = :code AND reset_expires_at > NOW()");
        $stmt->execute([':code' => $code]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user) {
            return false;
        }

        $updateStmt = $this->db->prepare("UPDATE users SET password = :password, reset_code = NULL, reset_expires_at = NULL WHERE id = :id");
        return $updateStmt->execute([
            ':password' => $hashedPassword,
            ':id' => $user['id']
        ]);
    }
}
