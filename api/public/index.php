<?php

declare(strict_types=1);

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

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

$requestPath = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST' && isset($_POST['_method']) && strtoupper($_POST['_method']) === 'PUT') {
    $method = 'PUT';
} elseif ($method === 'POST' && empty($_POST)) {
    $input = json_decode(file_get_contents('php://input'), true);
    if ($input) {
        $_POST = $input;
    }
}

$uriPath = trim($requestPath, '/');
$segments = explode('/', $uriPath);

$validResources = [
    'auth',
    'reservations',
    'categories',
    'features',
    'services',
    'customers',
    'admins',
    'audit-logs',
    'system-schedule',
    'service-zones'
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

match ($resource) {
    'auth' => match ($param1) {
        'login'          => (new AuthController())->login(),
        'forgot-password' => (new AuthController())->forgotPassword(),
        'reset-password'  => (new AuthController())->resetPassword(),
        'send-otp'        => (new CustomerAuthController())->sendOtp(),
        'verify-otp'      => (new CustomerAuthController())->verifyOtp(),
        default           => Response::json(['message' => 'Invalid authentication action'], 404)
    },
    'reservations' => match (true) {
        $id !== null && $subResource === 'customer-rating' && $method === 'POST'
        => (new CustomerAuthController())->submitCustomerRating($id),

        $id !== null && isset($_GET['action']) && $_GET['action'] === 'staff-rating' && $method === 'POST'
        => (new CustomerAuthController())->submitStaffRating($id),

        isset($_GET['action']) && in_array($_GET['action'], ['confirm', 'cancel', 'reschedule', 'feedback'], true)
        => (new App\Controllers\PublicReservationController())->handleAction(),

        default => (new ReservationController())->handle($method, $id, $subResource)
    },
    'categories'      => (new CategoryController())->handle($method, $id),
    'features'        => (new FeatureController())->handle($method, $id),
    'services'        => (new ServiceController())->handle($method, $id),
    'customers'       => (new CustomerController())->handle($method, $id),
    'admins'          => (new AdminController())->handle($method, $id, $subResource),
    'audit-logs'      => (new AuditController())->handle($param1),
    'system-schedule' => (new SystemScheduleController())->handle($method),
    'service-zones'   => (new ServiceZoneController())->handle($method, $id, $subResource),
    default           => Response::json(['message' => 'Endpoint not found'], 404)
};
