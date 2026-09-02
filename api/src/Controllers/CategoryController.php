<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\CategoryModel;
use App\Utils\Response;

class CategoryController {
    private CategoryModel $model;

    public function __construct() {
        $this->model = new CategoryModel();
    }

    public function handle(string $method): void {
        match ($method) {
            'GET' => Response::json($this->model->getAll()),
            'POST' => $this->create(),
            default => Response::json(['message' => 'Método no permitido'], 405)
        };
    }

    private function create(): void {
        $data = json_decode(file_get_contents('php://input'), true);

        if (empty($data['name'])) {
            Response::json(['message' => 'El nombre de la categoría es requerido'], 422);
        }

        $id = $this->model->create($data['name']);
        Response::json(['message' => 'Categoría creada', 'id' => $id], 201);
    }
}