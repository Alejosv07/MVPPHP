<?php

declare(strict_types=1);

ini_set('display_errors', '0');
error_reporting(E_ALL);

spl_autoload_register(function (string $class): void {
    $prefix = 'App\\';
    $base_dir = __DIR__ . '/../src/';

    $len = strlen($prefix);
    if (strncmp($prefix, $class, $len) !== 0) {
        return;
    }

    $relative_class = substr($class, $len);
    $file = $base_dir . str_replace('\\', '/', $relative_class) . '.php';

    if (file_exists($file)) {
        require_once $file;
    }
});

require_once __DIR__ . '/../config/database.php';

use App\Config\Config;
use App\Utils\Auth;
use App\Utils\Response;
use App\Controllers\AuthController;
use App\Controllers\CategoryController;
use App\Controllers\FeatureController;
use App\Controllers\ServiceController;
use App\Controllers\CustomerController;
use App\Controllers\ReservationController;
use App\Controllers\AdminController;
use App\Controllers\AuditController;
use App\Controllers\SystemScheduleController;
use App\Controllers\CustomerAuthController;
use App\Controllers\ServiceZoneController;
use App\Controllers\PublicReservationController;

/* ---------- Security headers & CORS ---------- */
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: strict-origin-when-cross-origin');

$allowedOrigins = array_filter(array_map('trim', explode(',', (string)Config::get('ALLOWED_ORIGINS'))));
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$isLocalOrigin = !Config::isProduction() && preg_match('#^https?://(localhost|127\.0\.0\.1)(:\d+)?$#', $origin);
if ($origin && (in_array($origin, $allowedOrigins, true) || $isLocalOrigin)) {
    header("Access-Control-Allow-Origin: {$origin}");
    header('Vary: Origin');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
    header('Access-Control-Max-Age: 600');
}
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

set_exception_handler(function (Throwable $e): void {
    error_log('Unhandled: ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    Response::json(['message' => 'An unexpected error occurred. Please try again later.'], 500);
});

/* ---------- Routing ---------- */
$requestPath = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST' && isset($_POST['_method']) && strtoupper($_POST['_method']) === 'PUT') {
    $method = 'PUT';
} elseif ($method === 'POST' && empty($_POST)) {
    $input = json_decode(file_get_contents('php://input'), true);
    if (is_array($input)) {
        $_POST = $input;
    }
}

$uriPath = trim((string)$requestPath, '/');
$segments = explode('/', $uriPath);

$validResources = [
    'auth', 'reservations', 'reviews', 'categories', 'features', 'services',
    'customers', 'admins', 'audit-logs', 'system-schedule', 'service-zones'
];

$resourceIndex = false;
foreach ($segments as $index => $segment) {
    if (in_array($segment, $validResources, true)) {
        $resourceIndex = $index;
        break;
    }
}

if ($resourceIndex !== false) {
    $segments = array_slice($segments, $resourceIndex);
}

$resource = $segments[0] ?? null;
$param1  = $segments[1] ?? null;
$param2  = $segments[2] ?? null;

$id = is_numeric($param1) ? (int)$param1 : null;
$subResource = is_numeric($param1) ? $param2 : $param1;

if ($id === null && isset($_GET['id']) && is_numeric($_GET['id'])) {
    $id = (int)$_GET['id'];
}

$isRead = $method === 'GET';
$emailActions = ['confirm', 'cancel', 'reschedule', 'feedback'];
$action = $_GET['action'] ?? null;

/*
 * Access matrix
 *  - Public catalog reads: services, categories, features, service zones, schedule
 *  - Public writes: booking request, email-link actions (signed token), OTP flows
 *  - Everything else requires a staff/admin token; most writes are ADMIN only
 */
match ($resource) {
    'auth' => match ($param1) {
        'login'           => (new AuthController())->login(),
        'forgot-password' => (new AuthController())->forgotPassword(),
        'reset-password'  => (new AuthController())->resetPassword(),
        'send-otp'        => (new CustomerAuthController())->sendOtp(),
        'verify-otp'      => (new CustomerAuthController())->verifyOtp(),
        default           => Response::json(['message' => 'Invalid authentication action'], 404)
    },

    'reviews' => $isRead
        ? (new ReservationController())->publicReviews()
        : Response::json(['message' => 'Method not allowed'], 405),

    'reservations' => match (true) {
        $id !== null && $subResource === 'customer-rating' && $method === 'POST'
            => Auth::requireCustomer() ? (new CustomerAuthController())->submitCustomerRating($id) : null,

        $id !== null && $action === 'staff-rating' && $method === 'POST'
            => Auth::require(['ADMIN', 'STAFF']) ? (new CustomerAuthController())->submitStaffRating($id) : null,

        in_array($action, $emailActions, true)
            => (new PublicReservationController())->handleAction(),

        // Public booking form (anonymous) or admin creation (with token)
        $method === 'POST' && $id === null
            => (new ReservationController())->handle($method, null, null),

        default => Auth::require(['ADMIN', 'STAFF'])
            ? (new ReservationController())->handle($method, $id, $subResource)
            : null
    },

    'categories'      => ($isRead || Auth::require(['ADMIN'])) ? (new CategoryController())->handle($method, $id) : null,
    'features'        => ($isRead || Auth::require(['ADMIN'])) ? (new FeatureController())->handle($method, $id) : null,
    'services'        => ($isRead || Auth::require(['ADMIN'])) ? (new ServiceController())->handle($method, $id) : null,
    'system-schedule' => ($isRead || Auth::require(['ADMIN'])) ? (new SystemScheduleController())->handle($method) : null,
    'service-zones'   => ($isRead || Auth::require(['ADMIN'])) ? (new ServiceZoneController())->handle($method, $id, $subResource) : null,

    // Staff list is needed by admin screens only
    'admins'          => Auth::require(['ADMIN']) ? (new AdminController())->handle($method, $id, $subResource) : null,
    'customers'       => Auth::require(['ADMIN']) ? (new CustomerController())->handle($method, $id) : null,
    'audit-logs'      => Auth::require(['ADMIN']) ? (new AuditController())->handle($param1) : null,

    default           => Response::json(['message' => 'Endpoint not found'], 404)
};
