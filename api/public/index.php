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

require_once __DIR__ . '/../config/Database.php';

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

$key = array_search('public', $segments);
if ($key !== false) {
    $segments = array_slice($segments, $key + 1);
} else {
    $keyApi = array_search('api', $segments);
    if ($keyApi !== false) {
        $segments = array_slice($segments, $keyApi + 1);
    }
}

$resource = $segments[0] ?? null;
$param1   = $segments[1] ?? null;
$param2   = $segments[2] ?? null;

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
        default          => Response::json(['message' => 'Invalid authentication action'], 404)
    },

    'categories'     => (new CategoryController())->handle($method, $id),
    'features'       => (new FeatureController())->handle($method, $id),
    'services'       => (new ServiceController())->handle($method, $id),
    'customers'      => (new CustomerController())->handle($method, $id),
    'reservations'   => (new ReservationController())->handle($method, $id, $subResource),
    'admins'         => (new AdminController())->handle($method, $id, $subResource),
    'audit-logs'     => (new AuditController())->handle($param1),
    'system-schedule' => (new SystemScheduleController())->handle($method),
    default          => Response::json(['message' => 'Endpoint not found'], 404)
};
