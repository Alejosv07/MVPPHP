<?php

declare(strict_types=1);

namespace App\Utils;

class Response
{
    /**
     * 
     * @param mixed $data 
     * @param int $code
     */
    public static function json(mixed $data, int $code = 200): void
    {
        http_response_code($code);

        header('Content-Type: application/json; charset=UTF-8');

        header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
        header('Cache-Control: post-check=0, pre-check=0', false);
        header('Pragma: no-cache');
        header('Expires: 0');

        echo json_encode([
            'status' => ($code >= 200 && $code < 300) ? 'success' : 'error',
            'data'   => $data
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

        exit;
    }
}
