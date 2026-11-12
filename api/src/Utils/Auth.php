<?php

declare(strict_types=1);

namespace App\Utils;

use App\Config\Config;

/**
 * Stateless signed tokens (HMAC-SHA256), sent as "Authorization: Bearer <token>".
 *
 * Two scopes:
 *  - "user":     admin / staff session issued on login
 *  - "customer": short-lived token issued after a valid email OTP
 */
final class Auth
{
    private static ?array $current = null;

    private static function secret(): string
    {
        $secret = (string)Config::get('APP_SECRET');
        if (strlen($secret) < 32) {
            error_log('APP_SECRET is missing or too short. Set it in api/config/secrets.php');
            Response::json(['message' => 'Server is not configured'], 500);
        }
        return $secret;
    }

    private static function b64(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function unb64(string $data): string|false
    {
        return base64_decode(strtr($data, '-_', '+/'), true);
    }

    public static function issue(array $claims, int $ttlSeconds): string
    {
        $claims['iat'] = time();
        $claims['exp'] = time() + $ttlSeconds;
        $payload = self::b64(json_encode($claims));
        $sig = self::b64(hash_hmac('sha256', $payload, self::secret(), true));
        return $payload . '.' . $sig;
    }

    public static function verify(string $token): ?array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 2) {
            return null;
        }
        [$payload, $sig] = $parts;
        $expected = self::b64(hash_hmac('sha256', $payload, self::secret(), true));
        if (!hash_equals($expected, $sig)) {
            return null;
        }
        $json = self::unb64($payload);
        $claims = $json !== false ? json_decode($json, true) : null;
        if (!is_array($claims) || ($claims['exp'] ?? 0) < time()) {
            return null;
        }
        return $claims;
    }

    private static function bearer(): ?string
    {
        $header = $_SERVER['HTTP_AUTHORIZATION']
            ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
            ?? (function_exists('getallheaders') ? (getallheaders()['Authorization'] ?? getallheaders()['authorization'] ?? null) : null);

        if ($header && preg_match('/^Bearer\s+(\S+)$/i', $header, $m)) {
            return $m[1];
        }
        return null;
    }

    /** Claims of the current request token (any scope), or null. */
    public static function claims(): ?array
    {
        if (self::$current === null) {
            $token = self::bearer();
            self::$current = $token ? (self::verify($token) ?? []) : [];
        }
        return self::$current ?: null;
    }

    public static function passwordFingerprint(string $passwordHash): string
    {
        return substr(hash_hmac('sha256', 'pwv:' . $passwordHash, self::secret()), 0, 20);
    }

    public static function user(): ?array
    {
        static $checked = null;
        if ($checked !== null) {
            return $checked ?: null;
        }

        $c = self::claims();
        if (!$c || ($c['scope'] ?? '') !== 'user' || empty($c['sub']) || empty($c['pwv'])) {
            $checked = [];
            return null;
        }

        $stmt = (new \App\Config\Database())->getConnection()
            ->prepare('SELECT role, is_active, password, name FROM users WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => (int)$c['sub']]);
        $row = $stmt->fetch(\PDO::FETCH_ASSOC);

        if (!$row
            || !(int)$row['is_active']
            || $row['role'] !== ($c['role'] ?? null)
            || !hash_equals(self::passwordFingerprint((string)$row['password']), (string)$c['pwv'])
        ) {
            $checked = [];
            return null;
        }

        $c['name'] = $row['name'];
        $checked = $c;
        return $c;
    }

    public static function userId(): ?int
    {
        $u = self::user();
        return $u ? (int)$u['sub'] : null;
    }

    public static function isAdmin(): bool
    {
        return (self::user()['role'] ?? '') === 'ADMIN';
    }

    public static function isStaff(): bool
    {
        return (self::user()['role'] ?? '') === 'STAFF';
    }

    /** Stops the request with 401/403 unless the user has one of the roles. */
    public static function require(array $roles = ['ADMIN']): array
    {
        $user = self::user();
        if (!$user) {
            Response::json(['message' => 'Authentication required'], 401);
        }
        if (!in_array($user['role'] ?? '', $roles, true)) {
            Response::json(['message' => 'You do not have permission to perform this action'], 403);
        }
        return $user;
    }

    public static function requireCustomer(): array
    {
        $c = self::claims();
        if (!$c || ($c['scope'] ?? '') !== 'customer' || empty($c['cids'])) {
            Response::json(['message' => 'Please verify your email again'], 401);
        }
        return array_map('intval', (array)$c['cids']);
    }

    public static function reservationLinkToken(int $reservationId, string $email): string
    {
        return hash_hmac('sha256', 'reservation:' . $reservationId . ':' . strtolower(trim($email)), self::secret());
    }

    public static function clientIp(): string
    {
        // Behind a trusted proxy only REMOTE_ADDR is reliable; headers can be forged.
        return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    }
}
