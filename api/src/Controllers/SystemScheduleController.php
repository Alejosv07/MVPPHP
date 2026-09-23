<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\SystemScheduleModel;
use App\Models\AuditModel;
use App\Utils\Response;

class SystemScheduleController {
    private SystemScheduleModel $model;
    private AuditModel $auditModel;

    public function __construct() {
        $this->model = new SystemScheduleModel();
        $this->auditModel = new AuditModel();
    }

    public function handle(string $method): void {
        ini_set('display_errors', '0');
        
        try {
            match ($method) {
                'GET' => Response::json($this->model->getSchedule()),
                'POST' => $this->save(),
                default => Response::json(['message' => 'Método no permitido'], 405)
            };
        } catch (\Exception $e) {
            Response::json(['message' => 'Error en el servidor: ' . $e->getMessage()], 500);
        }
    }

    private function save(): void {
        $inputData = $_POST;
        if (empty($inputData)) {
            $rawInput = file_get_contents('php://input');
            $inputData = json_decode($rawInput, true) ?? [];
        }

        $userId = $inputData['user_id'] ?? $_SESSION['user_id'] ?? null;
        $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';

        $saved = $this->model->saveSchedule($inputData);

        if ($saved) {
            $this->auditModel->log(
                $userId ? (int)$userId : null, 
                'UPDATE', 
                'system_settings', 
                0, 
                json_encode(['new_schedule' => $inputData]), 
                $ip
            );

            Response::json(['message' => 'System schedule updated successfully']);
        } else {
            Response::json(['message' => 'Failed to update system schedule'], 400);
        }
    }
}