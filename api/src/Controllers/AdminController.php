<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Config\Database;
use App\Models\AdminModel;
use App\Models\AuditModel;
use App\Utils\Auth;
use App\Utils\EmailService;
use App\Utils\Response;
use Exception;

class AdminController
{
    private const ROLES = ['ADMIN', 'STAFF'];

    private AdminModel $model;
    private AuditModel $auditModel;

    public function __construct()
    {
        $this->model = new AdminModel();
        $this->auditModel = new AuditModel();
    }

    private function input(): array
    {
        $data = json_decode(file_get_contents('php://input'), true);
        return is_array($data) ? $data : [];
    }

    private function audit(string $action, int $entityId, array $details): void
    {
        $this->auditModel->log(Auth::userId(), $action, 'USER', $entityId, json_encode($details), Auth::clientIp());
    }

    public function handle(string $method, ?int $id, ?string $subResource): void
    {
        if ($id !== null && $subResource === 'reset-token' && $method === 'POST') {
            $this->issueResetToken($id);
            return;
        }

        match ($method) {
            'GET'    => $id ? $this->getOne($id) : Response::json($this->model->getAll()),
            'POST'   => $this->create(),
            'PUT'    => $id ? $this->update($id) : Response::json(['message' => 'ID is required'], 400),
            'DELETE' => $id ? $this->delete($id) : Response::json(['message' => 'ID is required'], 400),
            default  => Response::json(['message' => 'Method not allowed'], 405)
        };
    }

    private function getOne(int $id): void
    {
        $admin = $this->model->getById($id);
        $admin ? Response::json($admin) : Response::json(['message' => 'User not found'], 404);
    }

    private function validate(array $data, bool $isCreate): ?string
    {
        if ($isCreate) {
            foreach (['name', 'email', 'password'] as $field) {
                if (empty($data[$field])) {
                    return "The field {$field} is required";
                }
            }
        }
        if (isset($data['email']) && !filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
            return 'Invalid email address';
        }
        if (isset($data['role']) && !in_array(strtoupper((string)$data['role']), self::ROLES, true)) {
            return 'Invalid role';
        }
        if (!empty($data['password'])) {
            $pw = (string)$data['password'];
            if (strlen($pw) < 8 || !preg_match('/[A-Z]/', $pw) || !preg_match('/\d/', $pw)) {
                return 'Password must be at least 8 characters and include an uppercase letter and a number';
            }
        }
        if (isset($data['name']) && mb_strlen(trim((string)$data['name'])) > 100) {
            return 'Name is too long';
        }
        return null;
    }

    private function create(): void
    {
        $data = $this->input();
        if ($error = $this->validate($data, true)) {
            Response::json(['message' => $error], 422);
        }
        if (isset($data['role'])) {
            $data['role'] = strtoupper((string)$data['role']);
        }

        try {
            $id = $this->model->create($data);
            $this->audit('CREATE', $id, ['email' => $data['email'], 'role' => $data['role'] ?? 'ADMIN']);
            Response::json(['message' => 'User created successfully', 'id' => $id], 201);
        } catch (Exception $e) {
            error_log('Admin create failed: ' . $e->getMessage());
            Response::json(['message' => 'Could not create user. The email may already be in use.'], 500);
        }
    }

    private function update(int $id): void
    {
        $data = $this->input();
        unset($data['reset_code']); // reset codes are issued only via /reset-token

        if ($error = $this->validate($data, false)) {
            Response::json(['message' => $error], 422);
        }
        if (isset($data['role'])) {
            $data['role'] = strtoupper((string)$data['role']);
        }
        if ($id === Auth::userId() && ((isset($data['is_active']) && !(int)$data['is_active']) || (($data['role'] ?? 'ADMIN') !== 'ADMIN'))) {
            Response::json(['message' => 'You cannot deactivate or demote your own account'], 422);
        }

        try {
            if ($this->model->update($id, $data)) {
                $logged = $data;
                unset($logged['password'], $logged['logged_user_id'], $logged['user_id']);
                if (!empty($data['password'])) {
                    $logged['password_changed'] = true;
                    if ($changed = $this->model->getById($id)) {
                        EmailService::sendPasswordChangedEmail($changed);
                    }
                }
                $this->audit('UPDATE', $id, $logged);
                Response::json(['message' => 'User updated successfully']);
            }
            Response::json(['message' => 'User not found or no changes made'], 404);
        } catch (Exception $e) {
            error_log('Admin update failed: ' . $e->getMessage());
            Response::json(['message' => 'Error updating user'], 500);
        }
    }

    /** Admin generates a one-time code to hand over to a staff member. */
    private function issueResetToken(int $id): void
    {
        if (!$this->model->getById($id)) {
            Response::json(['message' => 'User not found'], 404);
        }

        $resetCode = (string)random_int(100000, 999999);
        $db = (new Database())->getConnection();
        $db->prepare('UPDATE users SET reset_code = :code, reset_expires_at = DATE_ADD(NOW(), INTERVAL 15 MINUTE) WHERE id = :id')
            ->execute([':code' => $resetCode, ':id' => $id]);

        $stmt = $db->prepare('SELECT reset_expires_at FROM users WHERE id = :id');
        $stmt->execute([':id' => $id]);

        $this->audit('ISSUE_RESET_TOKEN', $id, ['issued' => true]);

        Response::json([
            'message'          => 'Password reset code issued successfully',
            'reset_code'       => $resetCode,
            'reset_expires_at' => $stmt->fetchColumn(),
        ]);
    }

    private function delete(int $id): void
    {
        if ($id === Auth::userId()) {
            Response::json(['message' => 'You cannot delete your own account'], 422);
        }

        try {
            if ($this->model->delete($id)) {
                $this->audit('DELETE', $id, ['deleted_id' => $id]);
                Response::json(['message' => 'User deleted successfully']);
            }
            Response::json(['message' => 'User not found'], 404);
        } catch (Exception $e) {
            error_log('Admin delete failed: ' . $e->getMessage());
            Response::json(['message' => 'This user has related records and cannot be deleted. Deactivate it instead.'], 409);
        }
    }
}
