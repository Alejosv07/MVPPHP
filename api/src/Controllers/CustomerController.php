<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\CustomerModel;
use App\Utils\Response;

class CustomerController {
    private CustomerModel $model;

    public function __construct() {
        $this->model = new CustomerModel();
    }

    public function handle(string $method, ?int $id): void {
        match ($method) {
            'GET' => $id ? $this->getOne($id) : Response::json($this->model->getAll()),
            default => Response::json(['message' => 'Método no permitido'], 405)
        };
    }

    private function getOne(int $id): void {
        $customer = $this->model->getById($id);
        if ($customer) {
            Response::json($customer);
        } else {
            Response::json(['message' => 'Cliente no encontrado'], 404);
        }
    }
}