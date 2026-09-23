<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Models\AuthModel;
use App\Utils\Response;
use App\Config\Database;

class AuthController
{
    private AuthModel $model;

    public function __construct()
    {
        $this->model = new AuthModel();
    }

    public function login(): void
    {
        $data = json_decode(file_get_contents('php://input'), true);

        if (empty($data['email']) || empty($data['password'])) {
            Response::json(['message' => 'Email and password are required'], 422);
            return;
        }

        $user = $this->model->findByEmail($data['email']);

        if (!$user) {
            Response::json(['message' => 'User not found in database'], 404);
            return;
        }

        if (password_verify($data['password'], $user['password'])) {
            unset($user['password'], $user['reset_code'], $user['reset_expires_at']);
            Response::json(['message' => 'Login successful', 'user' => $user]);
            return;
        } else {
            Response::json(['message' => 'Invalid credentials'], 401);
            return;
        }
    }

    public function forgotPassword(): void
    {
        $data = json_decode(file_get_contents('php://input'), true);

        if (empty($data['email'])) {
            Response::json(['message' => 'Email is required'], 422);
            return;
        }

        $code = (string)random_int(100000, 999999);

        if ($this->model->saveResetCode($data['email'], $code)) {

            $user = $this->model->findByEmail($data['email']);

            if ($user) {
                \App\Utils\EmailService::sendPasswordResetEmail($user, $code);
            }

            Response::json([
                'message' => 'Reset code sent to your email successfully'
            ]);
            return;
        } else {
            Response::json(['message' => 'User not found or inactive'], 404);
            return;
        }
    }

    public function resetPassword(): void
    {
        $data = json_decode(file_get_contents('php://input'), true);

        if (empty($data['code']) || empty($data['password'])) {
            Response::json(['message' => 'Code and new password are required'], 422);
            return;
        }

        $hashedPassword = password_hash($data['password'], PASSWORD_BCRYPT);

        if ($this->model->updatePasswordByCodeOnly($data['code'], $hashedPassword)) {
            Response::json(['message' => 'Password updated successfully']);
            return;
        } else {
            Response::json(['message' => 'Invalid or expired reset code'], 400);
            return;
        }
    }
}
