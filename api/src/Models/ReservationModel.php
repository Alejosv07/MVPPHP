<?php

declare(strict_types=1);

namespace App\Models;

use App\Config\Database;
use PDO;

class ReservationModel
{
    private PDO $db;

    public function __construct()
    {
        $this->db = (new Database())->getConnection();
    }

public function getAll(?int $staffId = null, ?string $search = null): array
    {
        $sql = "
            SELECT 
                r.*, 
                c.first_name, 
                c.last_name, 
                c.email, 
                c.phone_number,
                s.name AS service_name,
                u.name AS staff_name,
                rr.staff_rating,
                rr.staff_notes,
                rr.customer_rating,
                rr.customer_notes
            FROM reservations r
            LEFT JOIN reservation_ratings rr ON r.id = rr.reservation_id
            LEFT JOIN customers c ON r.customer_id = c.id
            LEFT JOIN services s ON r.service_id = s.id
            LEFT JOIN users u ON r.staff_id = u.id
            WHERE 1=1
        ";

        $params = [];

        if ($staffId !== null) {
            $sql .= " AND r.staff_id = :staff_id";
            $params[':staff_id'] = $staffId;
        }

        if (!empty($search)) {
            $sql .= " AND (c.first_name LIKE :search OR c.last_name LIKE :search OR c.email LIKE :search OR u.name LIKE :search)";
            $params[':search'] = "%{$search}%";
        }

        $sql .= " ORDER BY r.id DESC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getByMonthAndYear(int $month, int $year, ?int $staffId = null, ?string $search = null): array
    {
        $formattedMonth = str_pad((string)$month, 2, '0', STR_PAD_LEFT);

        $sql = "
            SELECT 
                r.*, 
                c.first_name, 
                c.last_name, 
                c.email, 
                c.phone_number,
                s.name AS service_name,
                u.name AS staff_name,
                rr.staff_rating,
                rr.staff_notes,
                rr.customer_rating,
                rr.customer_notes
            FROM reservations r
            LEFT JOIN reservation_ratings rr ON r.id = rr.reservation_id
            LEFT JOIN customers c ON r.customer_id = c.id
            LEFT JOIN services s ON r.service_id = s.id
            LEFT JOIN users u ON r.staff_id = u.id
            WHERE r.service_date LIKE :yearMonth
        ";

        $params = [':yearMonth' => "{$year}-{$formattedMonth}%"];

        if ($staffId !== null) {
            $sql .= " AND r.staff_id = :staff_id";
            $params[':staff_id'] = $staffId;
        }

        if (!empty($search)) {
            $sql .= " AND (c.first_name LIKE :search OR c.last_name LIKE :search OR c.email LIKE :search OR u.name LIKE :search)";
            $params[':search'] = "%{$search}%";
        }

        $sql .= " ORDER BY r.id DESC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getById(int $id): ?array
    {
        $stmt = $this->db->prepare("
            SELECT 
                r.*, 
                c.first_name, 
                c.last_name, 
                c.email, 
                c.phone_number,
                s.name AS service_name,
                u.name AS staff_name,
                u.email AS staff_email,
                rr.staff_rating,
                rr.staff_notes,
                rr.customer_rating,
                rr.customer_notes
            FROM reservations r
            LEFT JOIN reservation_ratings rr ON r.id = rr.reservation_id
            LEFT JOIN customers c ON r.customer_id = c.id
            LEFT JOIN services s ON r.service_id = s.id
            LEFT JOIN users u ON r.staff_id = u.id
            WHERE r.id = :id
            LIMIT 1
        ");
        $stmt->execute([':id' => $id]);
        $res = $stmt->fetch(PDO::FETCH_ASSOC);
        return $res ?: null;
    }

    public function createWithCustomer(array $data): int
    {
        $this->db->beginTransaction();

        try {
            $this->assertStatusSupported((string)($data['status'] ?? 'PENDING'));

            $stmtCustomer = $this->db->prepare("SELECT id FROM customers WHERE email = :email LIMIT 1");
            $stmtCustomer->execute([':email' => $data['email']]);
            $customer = $stmtCustomer->fetch(PDO::FETCH_ASSOC);

            if ($customer) {
                $customerId = (int)$customer['id'];
            } else {
                $stmtInsertCustomer = $this->db->prepare("
                    INSERT INTO customers (first_name, last_name, email, phone_number)
                    VALUES (:first_name, :last_name, :email, :phone_number)
                ");
                $stmtInsertCustomer->execute([
                    ':first_name'   => $data['first_name'],
                    ':last_name'    => $data['last_name'],
                    ':email'        => $data['email'],
                    ':phone_number' => $data['phone_number']
                ]);
                $customerId = (int)$this->db->lastInsertId();
            }

            $stmtReservation = $this->db->prepare("
                INSERT INTO reservations (
                    customer_id, service_id, service_date, preferred_time, 
                    service_address, special_instructions, status, 
                    bedrooms, bathrooms, frequency, total_price
                )
                VALUES (
                    :customer_id, :service_id, :service_date, :preferred_time, 
                    :service_address, :special_instructions, :status, 
                    :bedrooms, :bathrooms, :frequency, :total_price
                )
            ");
            $stmtReservation->execute([
                ':customer_id'          => $customerId,
                ':service_id'           => $data['service_id'],
                ':service_date'         => $data['service_date'],
                ':preferred_time'       => $data['preferred_time'],
                ':service_address'      => $data['service_address'],
                ':special_instructions' => $data['special_instructions'] ?? null,
                ':status'               => $data['status'] ?? 'PENDING',
                ':bedrooms'             => $data['bedrooms'] ?? 1,
                ':bathrooms'            => $data['bathrooms'] ?? 1,
                ':frequency'            => $data['frequency'] ?? 'One-time',
                ':total_price'          => $data['total_price'] ?? 0.00
            ]);

            $reservationId = (int)$this->db->lastInsertId();

            $stmtRating = $this->db->prepare("INSERT INTO reservation_ratings (reservation_id) VALUES (:id)");
            $stmtRating->execute([':id' => $reservationId]);

            $stmtHistory = $this->db->prepare("
                INSERT INTO reservation_history (reservation_id, user_id, previous_status, new_status, comment)
                VALUES (:reservation_id, :user_id, NULL, :status, 'Reservation created successfully.')
            ");
            $stmtHistory->execute([
                ':reservation_id' => $reservationId,
                ':user_id'        => $data['user_id'] ?? null,
                ':status'         => $data['status'] ?? 'PENDING'
            ]);

            $this->db->commit();
            return $reservationId;
        } catch (\Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    public function update(int $id, array $data): bool
    {
        $this->db->beginTransaction();

        try {
            $stmtRes = $this->db->prepare("SELECT customer_id FROM reservations WHERE id = :id LIMIT 1");
            $stmtRes->execute([':id' => $id]);
            $currentRes = $stmtRes->fetch(PDO::FETCH_ASSOC);

            if (!$currentRes) {
                $this->db->rollBack();
                return false;
            }

            $customerId = $currentRes['customer_id'];

            $stmtCust = $this->db->prepare("
                UPDATE customers 
                SET first_name = :first_name, last_name = :last_name, email = :email, phone_number = :phone_number 
                WHERE id = :customer_id
            ");
            $stmtCust->execute([
                ':first_name'   => $data['first_name'],
                ':last_name'    => $data['last_name'],
                ':email'        => $data['email'],
                ':phone_number' => $data['phone_number'],
                ':customer_id'  => $customerId
            ]);

            $stmtUpdate = $this->db->prepare("
                UPDATE reservations 
                SET service_id = :service_id, 
                    service_date = :service_date, 
                    preferred_time = :preferred_time, 
                    service_address = :service_address, 
                    special_instructions = :special_instructions, 
                    bedrooms = :bedrooms, 
                    bathrooms = :bathrooms, 
                    frequency = :frequency
                WHERE id = :id
            ");
            $stmtUpdate->execute([
                ':service_id'           => $data['service_id'],
                ':service_date'         => $data['service_date'],
                ':preferred_time'       => $data['preferred_time'],
                ':service_address'      => $data['service_address'],
                ':special_instructions' => $data['special_instructions'] ?? null,
                ':bedrooms'             => $data['bedrooms'] ?? 1,
                ':bathrooms'            => $data['bathrooms'] ?? 1,
                ':frequency'            => $data['frequency'] ?? 'One-time',
                ':id'                   => $id
            ]);

            $this->db->commit();
            return true;
        } catch (\Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    public function updateStatus(int $id, string $status, ?int $userId, ?string $comment): bool
    {
        $stmtPrev = $this->db->prepare("SELECT status FROM reservations WHERE id = :id LIMIT 1");
        $stmtPrev->execute([':id' => $id]);
        $prev = $stmtPrev->fetch(PDO::FETCH_ASSOC);

        if (!$prev) return false;

        $previousStatus = $prev['status'];

        $stmt = $this->db->prepare("UPDATE reservations SET status = :status WHERE id = :id");
        $updated = $stmt->execute([':status' => $status, ':id' => $id]);

        if ($updated) {
            $historyStmt = $this->db->prepare("
                INSERT INTO reservation_history (reservation_id, user_id, previous_status, new_status, comment)
                VALUES (:id, :user_id, :prev_status, :new_status, :comment)
            ");
            $historyStmt->execute([
                ':id'          => $id,
                ':user_id'     => $userId,
                ':prev_status' => $previousStatus,
                ':new_status'  => $status,
                ':comment'     => $comment ?? "Status changed from {$previousStatus} to {$status}"
            ]);
        }

        return $updated;
    }

    /**
     * MySQL in non-strict mode silently saves '' for a value missing from the ENUM.
     * Fail loudly instead (e.g. QUOTED before database/migrations/2026-11-12_quoted_status.sql is applied).
     */
    public function assertStatusSupported(string $status): void
    {
        static $allowed = null;
        if ($allowed === null) {
            $type = (string)$this->db->query("
                SELECT COLUMN_TYPE FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND COLUMN_NAME = 'status'
            ")->fetchColumn();
            preg_match_all("/'([^']+)'/", $type, $m);
            $allowed = $m[1];
        }
        if ($allowed && !in_array($status, $allowed, true)) {
            throw new \RuntimeException("Status {$status} is not in the database ENUM. Run the pending migration in database/migrations.");
        }
    }

    public function addHistory(int $id, ?int $userId, ?string $previousStatus, string $newStatus, string $comment): void
    {
        $this->db->prepare("
            INSERT INTO reservation_history (reservation_id, user_id, previous_status, new_status, comment)
            VALUES (:id, :user_id, :prev_status, :new_status, :comment)
        ")->execute([
            ':id'          => $id,
            ':user_id'     => $userId,
            ':prev_status' => $previousStatus,
            ':new_status'  => $newStatus,
            ':comment'     => mb_substr($comment, 0, 1000),
        ]);
    }

    /** Active user who can take jobs */
    public function isAssignableUser(int $userId): bool
    {
        $stmt = $this->db->prepare("SELECT 1 FROM users WHERE id = :id AND is_active = 1 LIMIT 1");
        $stmt->execute([':id' => $userId]);
        return (bool)$stmt->fetchColumn();
    }

    public function getHistory(int $reservationId): array
    {
        $stmt = $this->db->prepare("
            SELECT rh.*, u.name AS user_name
            FROM reservation_history rh
            LEFT JOIN users u ON rh.user_id = u.id
            WHERE rh.reservation_id = :id
            ORDER BY rh.created_at DESC
        ");
        $stmt->execute([':id' => $reservationId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Status change plus optional price/date/time/staff. Null means "keep the current value";
     * $unassignStaff removes the cleaner.
     */
    public function updateStatusWithDetails(int $id, string $status, ?int $userId, ?string $comment, ?float $totalPrice, ?string $serviceDate, ?string $preferredTime, ?int $staffId = null, bool $unassignStaff = false): bool
    {
        $stmtPrev = $this->db->prepare("SELECT status, total_price, service_date, preferred_time, staff_id FROM reservations WHERE id = :id LIMIT 1");
        $stmtPrev->execute([':id' => $id]);
        $prev = $stmtPrev->fetch(PDO::FETCH_ASSOC);

        if (!$prev) return false;

        $previousStatus = $prev['status'];
        $finalPrice = $totalPrice !== null ? $totalPrice : $prev['total_price'];
        $finalDate = $serviceDate !== null ? $serviceDate : $prev['service_date'];
        $finalTime = $preferredTime !== null ? $preferredTime : $prev['preferred_time'];
        $finalStaff = $unassignStaff ? null : ($staffId !== null ? $staffId : $prev['staff_id']);

        $this->assertStatusSupported($status);

        $stmt = $this->db->prepare("
            UPDATE reservations
            SET status = :status, 
                total_price = :total_price, 
                service_date = :service_date, 
                preferred_time = :preferred_time,
                staff_id = :staff_id
            WHERE id = :id
        ");

        $updated = $stmt->execute([
            ':status' => $status,
            ':total_price' => $finalPrice,
            ':service_date' => $finalDate,
            ':preferred_time' => $finalTime,
            ':staff_id' => $finalStaff,
            ':id' => $id
        ]);

        if ($updated) {
            $historyStmt = $this->db->prepare("
                INSERT INTO reservation_history (reservation_id, user_id, previous_status, new_status, comment)
                VALUES (:id, :user_id, :prev_status, :new_status, :comment)
            ");
            $historyStmt->execute([
                ':id'          => $id,
                ':user_id'     => $userId,
                ':prev_status' => $previousStatus,
                ':new_status'  => $status,
                ':comment'     => $comment ?? "Status/Staff updated successfully"
            ]);
        }

        return $updated;
    }

    /**
     * Public testimonials: 4-5 star reviews with a comment.
     * Exposes only first name + last initial, city part of the address and service name.
     */
    public function getPublicReviews(int $limit = 30): array
    {
        $stmt = $this->db->prepare("
            SELECT r.id, c.first_name, LEFT(c.last_name, 1) AS last_initial,
                   s.name AS service_name, r.service_address,
                   rr.customer_rating, rr.customer_notes, r.service_date
            FROM reservation_ratings rr
            JOIN reservations r ON r.id = rr.reservation_id
            LEFT JOIN customers c ON c.id = r.customer_id
            LEFT JOIN services s ON s.id = r.service_id
            -- Every rating is shown, good or bad: hiding reviews because of their score is
            -- prohibited by the FTC Consumer Reviews and Testimonials Rule (16 CFR Part 465)
            WHERE rr.customer_rating BETWEEN 1 AND 5
              AND rr.customer_notes IS NOT NULL AND rr.customer_notes <> ''
            ORDER BY r.service_date DESC
            LIMIT :lim
        ");
        $stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
        $stmt->execute();

        return array_map(static function (array $row): array {
            // Keep only the city/area portion of the address, never the street
            $parts = array_map('trim', explode(',', (string)$row['service_address']));
            $row['location'] = count($parts) > 1 ? $parts[count($parts) - 2] : '';
            if (preg_match('/\d/', $row['location'])) {
                $row['location'] = '';
            }
            unset($row['service_address']);
            $row['client_name'] = trim($row['first_name'] . ' ' . ($row['last_initial'] ? $row['last_initial'] . '.' : ''));
            return $row;
        }, $stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    /**
     * Stores proof of Terms acceptance / SMS opt-in.
     * Needs database/migrations/2026-11-08_consent_columns.sql; silently skipped until it is applied.
     */
    public function recordConsent(int $reservationId, bool $smsConsent, string $ip): void
    {
        try {
            $this->db->prepare("UPDATE reservations SET terms_accepted_at = NOW(), consent_ip = :ip WHERE id = :id")
                ->execute([":ip" => $ip, ":id" => $reservationId]);
            if ($smsConsent) {
                $this->db->prepare("UPDATE customers c JOIN reservations r ON r.customer_id = c.id SET c.sms_consent_at = NOW() WHERE r.id = :id")
                    ->execute([":id" => $reservationId]);
            }
        } catch (\PDOException $e) {
            error_log("Consent not recorded (run the consent migration): " . $e->getMessage());
        }
    }
}
