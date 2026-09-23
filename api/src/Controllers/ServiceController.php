<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\ServiceModel;
use App\Models\AuditModel;
use App\Config\Database;
use App\Utils\Response;
use PDO;

class ServiceController
{
    private ServiceModel $model;
    private AuditModel $auditModel;
    private PDO $db;

    public function __construct()
    {
        $this->model = new ServiceModel();
        $this->auditModel = new AuditModel();
        $this->db = (new Database())->getConnection();
    }

    public function handle(string $method, ?int $id): void
    {
        $pathInfo = $_SERVER['PATH_INFO'] ?? parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

        if (str_contains($pathInfo, '/features') && $id !== null) {
            if ($method === 'GET') {
                $this->getServiceFeatures($id);
                return;
            }
        }

        if ($id === null && isset($_GET['id']) && is_numeric($_GET['id'])) {
            $id = (int) $_GET['id'];
        }

        if ($method === 'POST' && isset($_POST['_method'])) {
            $method = strtoupper((string) $_POST['_method']);
        }

        if ($id !== null) {
            match ($method) {
                'GET' => $this->getOne($id),
                'PUT' => $this->update($id),
                'DELETE' => $this->delete($id),
                default => Response::json([
                    'message' => 'Method not allowed'
                ], 405)
            };

            return;
        }

        match ($method) {
            'GET' => Response::json($this->model->getAll()),
            'POST' => $this->create(),
            'DELETE' => Response::json([
                'message' => 'ID required'
            ], 400),
            default => Response::json([
                'message' => 'Method not allowed'
            ], 405)
        };
    }

    private function getOne(int $id): void
    {
        $service = $this->model->getById($id);

        if ($service) {
            Response::json($service);
        } else {
            Response::json([
                'message' => 'Service not found'
            ], 404);
        }
    }

    private function getServiceFeatures(int $serviceId): void
    {
        $stmt = $this->db->prepare("
            SELECT f.id, f.name
            FROM features f
            JOIN service_feature_relations sfr
                ON f.id = sfr.feature_id
            WHERE sfr.service_id = ?
        ");

        $stmt->execute([$serviceId]);

        Response::json($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    private function create(): void
    {
        $inputData = $_POST;
        if (empty($inputData)) {
            $rawInput = file_get_contents('php://input');
            $inputData = json_decode($rawInput, true) ?? [];
        }

        $imageUrl = null;

        if (
            isset($_FILES['image']) &&
            $_FILES['image']['error'] === UPLOAD_ERR_OK
        ) {
            $uploadDir = dirname(__DIR__, 3) . '/public/uploads/';

            if (!is_dir($uploadDir)) {
                mkdir($uploadDir, 0777, true);
            }

            $ext = pathinfo(
                $_FILES['image']['name'],
                PATHINFO_EXTENSION
            );

            $filename = uniqid('service_', true) . '.' . strtolower($ext);
            $uploadPath = $uploadDir . $filename;

            if (
                move_uploaded_file(
                    $_FILES['image']['tmp_name'],
                    $uploadPath
                )
            ) {
                $imageUrl = '/uploads/' . $filename;
            }
        }

        $data = $inputData;
        $data['image_url'] = $imageUrl;

        $id = $this->model->create($data);

        $featureIdsInput = $inputData['feature_ids'] ?? $_POST['feature_ids'] ?? null;

        $this->saveServiceFeatures(
            $id,
            $featureIdsInput
        );

        $userId = $inputData['user_id'] ?? $_POST['user_id'] ?? $_GET['user_id'] ?? ($_SESSION['user_id'] ?? null);
        $userId = is_numeric($userId) ? (int) $userId : null;

        $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';

        $details = json_encode([
            'new_state' => $this->model->getById($id),
            'feature_ids' => $featureIdsInput
        ]);

        $this->auditModel->log(
            $userId,
            'CREATE',
            'services',
            $id,
            $details,
            $ip
        );

        Response::json([
            'message' => 'Service created successfully',
            'id' => $id
        ], 201);
    }

    private function update(int $id): void
    {
        $currentService = $this->model->getById($id);

        if (!$currentService) {
            Response::json([
                'message' => 'Service not found'
            ], 404);

            return;
        }

        $inputData = $_POST;

        if (empty($inputData)) {
            $rawInput = file_get_contents('php://input');

            $inputData = json_decode(
                $rawInput,
                true
            ) ?? [];
        }

        $imageUrl = $currentService['image_url'] ?? null;

        if (
            isset($_FILES['image']) &&
            $_FILES['image']['error'] === UPLOAD_ERR_OK
        ) {
            $uploadDir = dirname(__DIR__, 3) . '/public/uploads/';

            if (!is_dir($uploadDir)) {
                mkdir($uploadDir, 0777, true);
            }

            $ext = pathinfo(
                $_FILES['image']['name'],
                PATHINFO_EXTENSION
            );

            $filename = uniqid('service_', true) . '.' . strtolower($ext);
            $uploadPath = $uploadDir . $filename;

            if (
                move_uploaded_file(
                    $_FILES['image']['tmp_name'],
                    $uploadPath
                )
            ) {
                $imageUrl = '/uploads/' . $filename;
            }
        }

        $data = [
            'category_id' => $inputData['category_id']
                ?? $currentService['category_id'],

            'name' => $inputData['name']
                ?? $currentService['name'],

            'description' => $inputData['description']
                ?? $currentService['description'],

            'price_per_hour' => $inputData['price_per_hour']
                ?? $currentService['price_per_hour'],

            'estimated_duration_hours' => $inputData['estimated_duration_hours']
                ?? $currentService['estimated_duration_hours'],

            'is_active' => isset($inputData['is_active'])
                ? (int) $inputData['is_active']
                : (int) ($currentService['is_active'] ?? 1),

            'image_url' => $imageUrl
        ];

        $updated = $this->model->update(
            $id,
            $data
        );

        $featureIdsInput = $inputData['feature_ids'] ?? null;

        $this->saveServiceFeatures(
            $id,
            $featureIdsInput
        );

        if ($updated) {
            $newServiceState = $this->model->getById($id);

            $userId = $inputData['user_id'] ?? $_POST['user_id'] ?? $_GET['user_id'] ?? ($_SESSION['user_id'] ?? null);
            $userId = is_numeric($userId) ? (int) $userId : null;

            $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';

            $details = json_encode([
                'previous_state' => $currentService,
                'new_state' => $newServiceState,
                'feature_ids' => $featureIdsInput
            ]);

            $this->auditModel->log(
                $userId,
                'UPDATE',
                'services',
                $id,
                $details,
                $ip
            );

            Response::json([
                'message' => 'Service updated successfully'
            ]);
        } else {
            Response::json([
                'message' => 'Failed to update or record not found'
            ], 400);
        }
    }

    private function saveServiceFeatures(
        int $serviceId,
        $featureIdsInput
    ): void {
        $stmtDel = $this->db->prepare("
            DELETE FROM service_feature_relations
            WHERE service_id = ?
        ");

        $stmtDel->execute([
            $serviceId
        ]);

        if (
            $featureIdsInput === null ||
            $featureIdsInput === ''
        ) {
            return;
        }

        $featureIds = [];

        if (is_string($featureIdsInput)) {
            $decoded = json_decode(
                $featureIdsInput,
                true
            );

            if (
                json_last_error() === JSON_ERROR_NONE &&
                is_array($decoded)
            ) {
                $featureIds = $decoded;
            } else {
                $featureIds = explode(
                    ',',
                    $featureIdsInput
                );
            }
        } elseif (is_array($featureIdsInput)) {
            $featureIds = $featureIdsInput;
        }

        if (empty($featureIds)) {
            return;
        }

        $stmtIns = $this->db->prepare("
            INSERT INTO service_feature_relations
                (service_id, feature_id)
            VALUES
                (?, ?)
        ");

        foreach ($featureIds as $featureId) {
            if (!is_numeric($featureId)) {
                continue;
            }

            $featureId = (int) $featureId;

            if ($featureId <= 0) {
                continue;
            }

            $stmtIns->execute([
                $serviceId,
                $featureId
            ]);
        }
    }

    private function delete(int $id): void
    {
        $currentService = $this->model->getById($id);

        if ($this->model->delete($id)) {
            $inputData = [];
            $rawInput = file_get_contents('php://input');
            if ($rawInput) {
                $inputData = json_decode($rawInput, true) ?? [];
            }

            $userId = $inputData['user_id'] ?? $_GET['user_id'] ?? $_POST['user_id'] ?? ($_SESSION['user_id'] ?? null);
            $userId = is_numeric($userId) ? (int) $userId : null;

            $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';

            $details = json_encode([
                'previous_state' => $currentService
            ]);

            $this->auditModel->log(
                $userId,
                'DELETE',
                'services',
                $id,
                $details,
                $ip
            );

            Response::json([
                'message' => 'Service deleted successfully'
            ]);
        } else {
            Response::json([
                'message' => 'Error deleting service'
            ], 400);
        }
    }
}