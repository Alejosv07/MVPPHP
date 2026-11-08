<?php

declare(strict_types=1);

namespace App\Utils;

/**
 * Simple file-based fixed-window rate limiter (no DB migration needed).
 * Files live in api/storage/ratelimit, which is blocked from the web.
 */
final class RateLimiter
{
    private static function dir(): string
    {
        $dir = dirname(__DIR__, 2) . '/storage/ratelimit';
        if (!is_dir($dir)) {
            @mkdir($dir, 0750, true);
            @file_put_contents(dirname($dir) . '/.htaccess', "Require all denied\n");
        }
        return $dir;
    }

    /**
     * Registers a hit and stops the request with 429 if over the limit.
     */
    public static function hit(string $bucket, string $key, int $maxAttempts, int $windowSeconds): void
    {
        $file = self::dir() . '/' . hash('sha256', $bucket . '|' . strtolower($key)) . '.json';
        $now = time();

        $fp = @fopen($file, 'c+');
        if (!$fp) {
            return; // fail open rather than block the business
        }
        flock($fp, LOCK_EX);
        $data = json_decode(stream_get_contents($fp) ?: '', true) ?: ['start' => $now, 'count' => 0];

        if ($now - $data['start'] >= $windowSeconds) {
            $data = ['start' => $now, 'count' => 0];
        }
        $data['count']++;

        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($data));
        flock($fp, LOCK_UN);
        fclose($fp);

        if ($data['count'] > $maxAttempts) {
            $retry = $windowSeconds - ($now - $data['start']);
            header('Retry-After: ' . max(1, $retry));
            Response::json(['message' => 'Too many attempts. Please try again later.'], 429);
        }
    }

    public static function clear(string $bucket, string $key): void
    {
        @unlink(self::dir() . '/' . hash('sha256', $bucket . '|' . strtolower($key)) . '.json');
    }
}
