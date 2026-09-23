<?php
declare(strict_types=1);

namespace App\Models;

use App\Config\Database;
use PDO;

class SystemScheduleModel {
    private PDO $db;

    public function __construct() {
        $this->db = (new Database())->getConnection();
    }

    public function getSchedule(): array {
        try {
            $stmt = $this->db->query("SELECT setting_key, setting_value FROM system_settings");
            $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            $settings = [
                'global_blocked_days' => [],
                'global_block_time_start' => '',
                'global_block_time_end' => '',
                'blocked_specific_dates' => []
            ];

            foreach ($results as $row) {
                $key = $row['setting_key'];
                $val = $row['setting_value'];

                $decoded = json_decode((string)$val, true);
                if (json_last_error() === JSON_ERROR_NONE) {
                    $settings[$key] = $decoded;
                } else {
                    $settings[$key] = $val;
                }
            }

            return $settings;
        } catch (\Exception $e) {
            return [
                'global_blocked_days' => [],
                'global_block_time_start' => '',
                'global_block_time_end' => '',
                'blocked_specific_dates' => []
            ];
        }
    }

    public function saveSchedule(array $data): bool {
        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare("
                INSERT INTO system_settings (setting_key, setting_value) 
                VALUES (?, ?) 
                ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
            ");

            foreach ($data as $key => $value) {
                $valToStore = is_array($value) ? json_encode($value) : ($value ?? '');
                $stmt->execute([$key, $valToStore]);
            }

            $this->db->commit();
            return true;
        } catch (\Exception $e) {
            $this->db->rollBack();
            return false;
        }
    }
}