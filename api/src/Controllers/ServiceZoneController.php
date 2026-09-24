<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Models\ServiceZoneModel;
use App\Models\AuditModel;
use App\Utils\Response;
use Exception;

class ServiceZoneController
{
    private ServiceZoneModel $model;
    private AuditModel $auditModel;

    public function __construct()
    {
        $this->model = new ServiceZoneModel();
        $this->auditModel = new AuditModel();
    }

    public function handle(string $method, ?int $id, ?string $subResource = null): void
    {
        if ($subResource === 'active' && $method === 'GET') {
            Response::json($this->model->getActiveZonesAndAreas());
            return;
        }

        if (!$id && isset($_GET['id'])) {
            $id = (int)$_GET['id'];
        }

        match ($method) {
            'GET'    => $id ? $this->getOne($id) : $this->getAll(),
            'POST'   => $this->create(),
            'PUT'    => $id ? $this->update($id) : Response::json(['message' => 'ID is required'], 400),
            'DELETE' => $id ? $this->delete($id) : Response::json(['message' => 'ID is required'], 400),
            default  => Response::json(['message' => 'Method not allowed'], 405)
        };
    }

    private function getAll(): void
    {
        Response::json($this->model->getAll());
    }

    private function getOne(int $id): void
    {
        $zone = $this->model->getById($id);
        if ($zone) {
            Response::json($zone);
        } else {
            Response::json(['message' => 'Service zone not found'], 404);
        }
    }

    private function create(): void
    {
        $data = json_decode(file_get_contents('php://input'), true);

        if (empty($data['city_name'])) {
            Response::json(['message' => 'The city name is required'], 422);
            return;
        }

        try {
            $id = $this->model->create($data);

            $this->logActivity(
                $data['user_id'] ?? null,
                'CREATE',
                'service_zones',
                $id,
                ['city_name' => $data['city_name'], 'areas' => $data['areas'] ?? []]
            );

            Response::json(['message' => 'Service zone created successfully', 'id' => $id], 201);
        } catch (Exception $e) {
            Response::json(['message' => 'Error creating service zone', 'error_detail' => $e->getMessage()], 500);
        }
    }

    private function update(int $id): void
    {
        $data = json_decode(file_get_contents('php://input'), true);

        if (empty($data['city_name'])) {
            Response::json(['message' => 'The city name is required'], 422);
            return;
        }

        try {
            $success = $this->model->update($id, $data);

            if ($success) {
                $this->logActivity(
                    $data['user_id'] ?? null,
                    'UPDATE',
                    'service_zones',
                    $id,
                    ['city_name' => $data['city_name'], 'areas' => $data['areas'] ?? []]
                );

                Response::json(['message' => 'Service zone updated successfully']);
            } else {
                Response::json(['message' => 'Service zone not found or no changes made'], 404);
            }
        } catch (Exception $e) {
            Response::json(['message' => 'Error updating service zone', 'error_detail' => $e->getMessage()], 500);
        }
    }

    private function delete(int $id): void
    {
        $data = json_decode(file_get_contents('php://input'), true) ?? [];
        $userId = $data['user_id'] ?? null;

        try {
            $success = $this->model->delete($id);

            if ($success) {
                $this->logActivity(
                    $userId,
                    'DELETE',
                    'service_zones',
                    $id,
                    ['deleted_zone_id' => $id]
                );

                Response::json(['message' => 'Service zone deleted successfully']);
            } else {
                Response::json(['message' => 'Service zone not found'], 404);
            }
        } catch (Exception $e) {
            Response::json(['message' => 'Error deleting service zone', 'error_detail' => $e->getMessage()], 500);
        }
    }

    private function logActivity(?int $userId, string $action, string $entityType, int $entityId, array $details): void
    {
        $ipAddress = $_SERVER['HTTP_CLIENT_IP'] ?? $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
        if (str_contains($ipAddress, ',')) {
            $ipAddress = trim(explode(',', $ipAddress)[0]);
        }
        if ($ipAddress === '::1') {
            $ipAddress = '127.0.0.1';
        }

        try {
            if (method_exists($this->auditModel, 'log')) {
                $this->auditModel->log($userId, $action, $entityType, $entityId, json_encode($details), $ipAddress);
            }
        } catch (Exception $e) {
            error_log("Failed to insert activity log: " . $e->getMessage());
        }
    }
}