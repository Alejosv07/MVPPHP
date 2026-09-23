<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\FeatureModel;
use App\Utils\Response;

class FeatureController
{
    private FeatureModel $model;

    public function __construct()
    {
        $this->model = new FeatureModel();
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
        $feature = $this->model->getById($id);

        if ($feature) {
            Response::json($feature);
        } else {
            Response::json(['message' => 'Característica no encontrada'], 404);
        }
    }

    private function create(): void
    {
        $inputData = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $name = trim($inputData['name'] ?? '');

        if (empty($name)) {
            Response::json(['message' => 'El nombre es requerido'], 400);
            return;
        }

        try {
            $id = $this->model->create($name);
            Response::json([
                'message' => 'Característica creada con éxito',
                'id' => $id
            ], 201);
        } catch (\PDOException $e) {
            Response::json(['message' => 'La característica ya existe o ocurrió un error'], 400);
        }
    }

    private function update(int $id): void
    {
        $inputData = json_decode(file_get_contents('php://input'), true) ?? $_POST;
        $name = trim($inputData['name'] ?? '');

        if (empty($name)) {
            Response::json(['message' => 'El nombre es requerido'], 400);
            return;
        }

        if ($this->model->update($id, $name)) {
            Response::json(['message' => 'Característica actualizada con éxito']);
        } else {
            Response::json(['message' => 'Error al actualizar'], 400);
        }
    }

    private function delete(int $id): void
    {
        if ($this->model->delete($id)) {
            Response::json(['message' => 'Característica eliminada']);
        } else {
            Response::json(['message' => 'Error al eliminar'], 400);
        }
    }
}