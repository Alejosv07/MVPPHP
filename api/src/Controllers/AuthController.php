<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Config\Config;
use App\Models\AuthModel;
use App\Utils\Auth;
use App\Utils\EmailService;
use App\Utils\RateLimiter;
use App\Utils\Response;

class AuthController
{
    private AuthModel $model;

    public function __construct()
    {
        $this->model = new AuthModel();
    }

    private function input(): array
    {
        $data = json_decode(file_get_contents('php://input'), true);
        return is_array($data) ? $data : [];
    }

    public function login(): void
    {
        $data = $this->input();
        $email = strtolower(trim((string)($data['email'] ?? '')));
        $password = (string)($data['password'] ?? '');

        if ($email === '' || $password === '') {
            Response::json(['message' => 'Email and password are required'], 422);
        }

        RateLimiter::hit('login-ip', Auth::clientIp(), 30, 900);
        RateLimiter::hit('login-email', $email, 8, 900);

        $user = $this->model->findByEmail($email);

        // Same answer whether the user exists or not (prevents account enumeration)
        if (!$user || !password_verify($password, $user['password'])) {
            Response::json(['message' => 'Invalid credentials'], 401);
        }

        RateLimiter::clear('login-email', $email);

        $token = Auth::issue([
            'scope' => 'user',
            'sub'   => (int)$user['id'],
            'role'  => $user['role'],
            'name'  => $user['name'],
        ], (int)Config::get('TOKEN_TTL'));

        Response::json([
            'message' => 'Login successful',
            'token'   => $token,
            'user'    => [
                'id'    => (int)$user['id'],
                'name'  => $user['name'],
                'email' => $user['email'],
                'role'  => $user['role'],
                'token' => $token,
            ],
        ]);
    }

    public function forgotPassword(): void
    {
        $data = $this->input();
        $email = strtolower(trim((string)($data['email'] ?? '')));

        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Response::json(['message' => 'A valid email is required'], 422);
        }

        RateLimiter::hit('forgot-ip', Auth::clientIp(), 10, 3600);
        RateLimiter::hit('forgot-email', $email, 3, 900);

        $user = $this->model->findByEmail($email);
        if ($user) {
            $code = (string)random_int(100000, 999999);
            $this->model->saveResetCode($email, $code);
            EmailService::sendPasswordResetEmail($user, $code);
        }

        // Always the same response
        Response::json(['message' => 'If the email is registered, a reset code has been sent.']);
    }

    public function resetPassword(): void
    {
        $data = $this->input();
        $email = strtolower(trim((string)($data['email'] ?? '')));
        $code = trim((string)($data['code'] ?? ''));
        $password = (string)($data['password'] ?? '');

        if ($email === '' || $code === '' || $password === '') {
            Response::json(['message' => 'Email, code and new password are required'], 422);
        }

        if (strlen($password) < 8 || !preg_match('/[A-Z]/', $password) || !preg_match('/\d/', $password)) {
            Response::json(['message' => 'Password must be at least 8 characters and include an uppercase letter and a number'], 422);
        }

        RateLimiter::hit('reset-ip', Auth::clientIp(), 20, 3600);
        RateLimiter::hit('reset-email', $email, 5, 900);

        $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

        if ($this->model->updatePasswordWithCode($email, $code, $hashedPassword)) {
            RateLimiter::clear('reset-email', $email);
            Response::json(['message' => 'Password updated successfully']);
        }

        Response::json(['message' => 'Invalid or expired reset code'], 400);
    }
}
