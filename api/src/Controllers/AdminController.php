<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Models\AdminModel;
use App\Models\AuditModel;
use App\Utils\Response;
use Exception;

class AdminController
{
    private AdminModel $model;
    private AuditModel $auditModel;

    public function __construct()
    {
        $this->model = new AdminModel();
        $this->auditModel = new AuditModel();
    }

    public function handle(string $method, ?int $id, ?string $subResource): void
    {
        if (!$id && isset($_GET['id'])) {
            $id = (int)$_GET['id'];
        }

        if ($id !== null && $subResource === 'reset-token' && $method === 'POST') {
            $this->issueResetToken($id);
            return;
        }

        match ($method) {
            'GET'     => $id ? $this->getOne($id) : Response::json($this->model->getAll()),
            'POST'    => $this->create(),
            'PUT'     => $id ? $this->update($id) : Response::json(['message' => 'ID is required'], 400),
            'DELETE'  => $id ? $this->delete($id) : Response::json(['message' => 'ID is required'], 400),
            default   => Response::json(['message' => 'Method not allowed'], 405)
        };
    }

    private function getOne(int $id): void
    {
        $admin = $this->model->getById($id);
        if ($admin) {
            Response::json($admin);
        } else {
            Response::json(['message' => 'Administrator not found'], 404);
        }
    }

    private function create(): void
    {
        $data = json_decode(file_get_contents('php://input'), true);

        $required = ['name', 'email', 'password'];
        foreach ($required as $field) {
            if (empty($data[$field])) {
                Response::json(['message' => "The field {$field} is required"], 422);
                return;
            }
        }

        try {
            $id = $this->model->create($data);
            
            $userId = isset($data['logged_user_id']) ? (int)$data['logged_user_id'] : null;
            $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
            $this->auditModel->log($userId, 'CREATE', 'USER', $id, json_encode(['email' => $data['email']]), $ip);

            Response::json(['message' => 'Administrator created successfully', 'id' => $id], 201);
        } catch (Exception $e) {
            Response::json([
                'message' => 'Error saving administrator',
                'error_detail' => $e->getMessage()
            ], 500);
        }
    }

    private function update(int $id): void
    {
        $data = json_decode(file_get_contents('php://input'), true);

        try {
            $success = $this->model->update($id, $data);

            if ($success) {
                $userId = isset($data['logged_user_id']) ? (int)$data['logged_user_id'] : null;
                $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
                $this->auditModel->log($userId, 'UPDATE', 'USER', $id, json_encode($data), $ip);

                Response::json(['message' => 'Administrator updated successfully']);
            } else {
                Response::json(['message' => 'Administrator not found or no changes made'], 404);
            }
        } catch (Exception $e) {
            Response::json([
                'message' => 'Error updating administrator',
                'detail' => $e->getMessage()
            ], 500);
        }
    }

    private function issueResetToken(int $id): void
    {
        $admin = $this->model->getById($id);
        if (!$admin) {
            Response::json(['message' => 'Administrator not found'], 404);
            return;
        }

        $resetCode = (string)random_int(100000, 999999);

        try {
            $db = (new \App\Config\Database())->getConnection();
            $stmt = $db->prepare("UPDATE users SET reset_code = :code, reset_expires_at = DATE_ADD(NOW(), INTERVAL 15 MINUTE) WHERE id = :id");
            $stmt->execute([':code' => $resetCode, ':id' => $id]);

            $stmtSelect = $db->prepare("SELECT reset_code, reset_expires_at FROM users WHERE id = :id");
            $stmtSelect->execute([':id' => $id]);
            $updatedAdmin = $stmtSelect->fetch(\PDO::FETCH_ASSOC);

            if ($updatedAdmin) {
                $data = json_decode(file_get_contents('php://input'), true) ?? [];
                $userId = isset($data['logged_user_id']) ? (int)$data['logged_user_id'] : null;
                $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
                
                $this->auditModel->log($userId, 'ISSUE_RESET_TOKEN', 'USER', $id, json_encode(['reset_code' => $resetCode]), $ip);

                Response::json([
                    'message' => 'Password reset link issued successfully',
                    'reset_code' => $updatedAdmin['reset_code'],
                    'reset_expires_at' => $updatedAdmin['reset_expires_at']
                ]);
            } else {
                Response::json(['message' => 'Failed to issue reset token'], 400);
            }
        } catch (Exception $e) {
            Response::json([
                'message' => 'Error issuing reset token',
                'detail' => $e->getMessage()
            ], 500);
        }
    }

    private function delete(int $id): void
    {
        try {
            $success = $this->model->delete($id);

            if ($success) {
                $data = json_decode(file_get_contents('php://input'), true) ?? [];
                $userId = isset($data['logged_user_id']) ? (int)$data['logged_user_id'] : null;
                $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
                
                $this->auditModel->log($userId, 'DELETE', 'USER', $id, json_encode(['deleted_id' => $id]), $ip);

                Response::json(['message' => 'Administrator deleted successfully']);
            } else {
                Response::json(['message' => 'Administrator not found'], 404);
            }
        } catch (Exception $e) {
            Response::json([
                'message' => 'Error deleting administrator',
                'detail' => $e->getMessage()
            ], 500);
        }
    }
}