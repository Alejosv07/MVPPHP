<?php
declare(strict_types=1);

namespace App\Config;

require_once __DIR__ . '/config.php';

use PDO;
use PDOException;

class Database {
    private static ?PDO $shared = null;

    public function getConnection(): ?PDO {
        if (self::$shared !== null) {
            return self::$shared;
        }

        try {
            $dsn = sprintf(
                'mysql:host=%s;dbname=%s;charset=utf8mb4',
                Config::get('DB_HOST'),
                Config::get('DB_NAME')
            );
            $options = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ];

            self::$shared = new PDO($dsn, (string)Config::get('DB_USER'), (string)Config::get('DB_PASSWORD'), $options);
        } catch (PDOException $e) {
            error_log('DB connection failed: ' . $e->getMessage());
            http_response_code(500);
            header('Content-Type: application/json; charset=UTF-8');
            echo json_encode([
                'status'  => 'error',
                'data'    => ['message' => 'Service temporarily unavailable']
            ]);
            exit;
        }

        return self::$shared;
    }
}
