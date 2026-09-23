<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\CategoryModel;
use App\Models\AuditModel;
use App\Utils\Response;

class CategoryController {
    private CategoryModel $model;
    private AuditModel $auditModel;

    public function __construct() {
        $this->model = new CategoryModel();
        $this->auditModel = new AuditModel();
    }

    public function handle(string $method, ?int $id): void {
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
            default => Response::json(['message' => 'Método no permitido'], 405)
        };
    }

    private function getOne(int $id): void {
        $category = $this->model->getById($id);
        if ($category) {
            Response::json($category);
        } else {
            Response::json(['message' => 'Categoría no encontrada'], 404);
        }
    }

    private function create(): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? $_POST;

        if (empty($data['name'])) {
            Response::json(['message' => 'El nombre de la categoría es requerido'], 422);
        }

        $id = $this->model->create($data['name'], $data['description'] ?? null);
        
        $userId = $data['user_id'] ?? $_SESSION['user_id'] ?? null;
        $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
        $this->auditModel->log($userId ? (int)$userId : null, 'CREATE', 'service_categories', $id, json_encode($data), $ip);

        Response::json(['message' => 'Categoría creada', 'id' => $id], 201);
    }

    private function update(int $id): void {
        $data = json_decode(file_get_contents('php://input'), true) ?? $_POST;

        if (empty($data['name'])) {
            Response::json(['message' => 'El nombre de la categoría es requerido'], 422);
        }

        $updated = $this->model->update($id, $data['name'], $data['description'] ?? null);

        if ($updated) {
            $userId = $data['user_id'] ?? $_SESSION['user_id'] ?? null;
            $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
            $this->auditModel->log($userId ? (int)$userId : null, 'UPDATE', 'service_categories', $id, json_encode($data), $ip);

            Response::json(['message' => 'Categoría actualizada exitosamente']);
        } else {
            Response::json(['message' => 'Error al actualizar o categoría no encontrada'], 400);
        }
    }

    private function delete(int $id): void {
        try {
            $deleted = $this->model->delete($id);
            if ($deleted) {
                $userId = $_GET['user_id'] ?? $_SESSION['user_id'] ?? null;
                $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
                $this->auditModel->log($userId ? (int)$userId : null, 'DELETE', 'service_categories', $id, null, $ip);

                Response::json(['message' => 'Categoría eliminada exitosamente']);
            } else {
                Response::json(['message' => 'Categoría no encontrada'], 404);
            }
        } catch (\PDOException $e) {
            Response::json(['message' => 'No se puede eliminar la categoría porque tiene servicios asociados.'], 400);
        }
    }
}