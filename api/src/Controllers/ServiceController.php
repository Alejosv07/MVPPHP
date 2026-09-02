<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Models\ServiceModel;
use App\Utils\Response;

class ServiceController
{
    private ServiceModel $model;

    public function __construct()
    {
        $this->model = new ServiceModel();
    }

    public function handle(string $method, ?int $id): void
    {
        if ($id === null && isset($_GET['id']) && is_numeric($_GET['id'])) {
            $id = (int)$_GET['id'];
        }

        if ($method === 'POST' && isset($_POST['_method'])) {
            $method = strtoupper((string)$_POST['_method']);
        }

        if ($id !== null) {
            match ($method) {
                'GET' => $this->getOne($id),
                'PUT' => $this->update($id),
                'DELETE' => $this->delete($id),
                default => Response::json(['message' => 'Método no permitido'], 405)
            };
            return;
        }

        match ($method) {
            'GET' => Response::json($this->model->getAll()),
            'POST' => $this->create(),
            'DELETE' => Response::json(['message' => 'ID requerido'], 400),
            default => Response::json(['message' => 'Método no permitido'], 405)
        };
    }

    private function getOne(int $id): void
    {
        $service = $this->model->getById($id);

        if ($service) {
            Response::json($service);
        } else {
            Response::json(['message' => 'Servicio no encontrado'], 404);
        }
    }

    private function create(): void
    {
        $data = $_POST;
        $imageUrl = null;

        if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
            $uploadDir = dirname(__DIR__, 3) . '/public/uploads/';

            if (!is_dir($uploadDir)) {
                mkdir($uploadDir, 0777, true);
            }

            $ext = pathinfo($_FILES['image']['name'], PATHINFO_EXTENSION);
            $filename = uniqid('service_', true) . '.' . strtolower($ext);
            $uploadPath = $uploadDir . $filename;

            if (move_uploaded_file($_FILES['image']['tmp_name'], $uploadPath)) {
                $imageUrl = '/uploads/' . $filename;
            }
        }

        $data['image_url'] = $imageUrl;

        $id = $this->model->create($data);

        Response::json([
            'message' => 'Service created successfully',
            'id' => $id
        ], 201);
    }

    private function update(int $id): void
    {
        $currentService = $this->model->getById($id);

        if (!$currentService) {
            Response::json(['message' => 'Servicio no encontrado'], 404);
            return;
        }

        $inputData = $_POST;

        if (empty($inputData)) {
            $rawInput = file_get_contents('php://input');
            $inputData = json_decode($rawInput, true) ?? [];
        }

        $imageUrl = $currentService['image_url'] ?? null;

        if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
            $uploadDir = dirname(__DIR__, 3) . '/public/uploads/';

            if (!is_dir($uploadDir)) {
                mkdir($uploadDir, 0777, true);
            }

            $ext = pathinfo($_FILES['image']['name'], PATHINFO_EXTENSION);
            $filename = uniqid('service_', true) . '.' . strtolower($ext);
            $uploadPath = $uploadDir . $filename;

            if (move_uploaded_file($_FILES['image']['tmp_name'], $uploadPath)) {
                $imageUrl = '/uploads/' . $filename;
            }
        }

        $data = [
            'category_id' => $inputData['category_id'] ?? $currentService['category_id'],
            'name' => $inputData['name'] ?? $currentService['name'],
            'description' => $inputData['description'] ?? $currentService['description'],
            'price_per_hour' => $inputData['price_per_hour'] ?? $currentService['price_per_hour'],
            'estimated_duration_hours' => $inputData['estimated_duration_hours'] ?? $currentService['estimated_duration_hours'],
            'is_active' => isset($inputData['is_active'])
                ? (int)$inputData['is_active']
                : (int)($currentService['is_active'] ?? 1),
            'image_url' => $imageUrl
        ];

        $updated = $this->model->update($id, $data);

        if ($updated) {
            Response::json([
                'message' => 'Service updated successfully'
            ]);
        } else {
            Response::json([
                'message' => 'Failed to update or record not found'
            ], 400);
        }
    }

    private function delete(int $id): void
    {
        if ($this->model->delete($id)) {
            Response::json([
                'message' => 'Servicio eliminado'
            ]);
        } else {
            Response::json([
                'message' => 'Error al eliminar'
            ], 400);
        }
    }
}