<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\AuditModel;
use App\Utils\Response;

class AuditController {
    private AuditModel $model;

    public function __construct() {
        $this->model = new AuditModel();
    }

    public function handle(?string $subResource = null): void {
        $method = $_SERVER['REQUEST_METHOD'];

        if ($method !== 'GET') {
            Response::json(['message' => 'Method not allowed'], 405);
            return;
        }

        try {
            if ($subResource === 'history') {
                $data = $this->model->getReservationHistory();
                Response::json($data);
            } else {
                $data = $this->model->getLogs();
                Response::json($data);
            }
        } catch (\Exception $e) {
            Response::json(['message' => 'Error retrieving audit logs: ' . $e->getMessage()], 500);
        }
    }
}