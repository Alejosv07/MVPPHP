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

public function getAll(?int $staffId = null): array
    {
        $sql = "
            SELECT 
                r.*, 
                c.first_name, 
                c.last_name, 
                c.email, 
                c.phone_number,
                s.name AS service_name,
                u.name AS staff_name
            FROM reservations r
            LEFT JOIN customers c ON r.customer_id = c.id
            LEFT JOIN services s ON r.service_id = s.id
            LEFT JOIN users u ON r.staff_id = u.id
        ";

        $params = [];
        if ($staffId !== null) {
            $sql .= " WHERE r.staff_id = :staff_id";
            $params[':staff_id'] = $staffId;
        }

        $sql .= " ORDER BY r.id DESC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function getByMonthAndYear(int $month, int $year, ?int $staffId = null): array
    {
        $formattedMonth = str_pad((string)$month, 2, '0', STR_PAD_LEFT);

        $sql = "
            SELECT 
                r.*, 
                c.first_name, 
                c.last_name, 
                c.email, 
                c.phone_number,
                s.name AS service_name
            FROM reservations r
            LEFT JOIN customers c ON r.customer_id = c.id
            LEFT JOIN services s ON r.service_id = s.id
            WHERE r.service_date LIKE :yearMonth
        ";

        $params = [':yearMonth' => "{$year}-{$formattedMonth}%"];

        if ($staffId !== null) {
            $sql .= " AND r.staff_id = :staff_id";
            $params[':staff_id'] = $staffId;
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
                u.name AS staff_name
            FROM reservations r
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

            $stmtHistory = $this->db->prepare("
                INSERT INTO reservation_history (reservation_id, user_id, previous_status, new_status, comment)
                VALUES (:reservation_id, :user_id, NULL, 'PENDING', 'Reservation created successfully.')
            ");
            $stmtHistory->execute([
                ':reservation_id' => $reservationId,
                ':user_id'        => $data['user_id'] ?? null
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
                    frequency = :frequency, 
                    total_price = :total_price
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
                ':total_price'          => $data['total_price'] ?? 0.00,
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

    public function updateStatusWithDetails(int $id, string $status, ?int $userId, ?string $comment, ?float $totalPrice, ?string $serviceDate, ?string $preferredTime, ?int $staffId = null): bool
    {
        $stmtPrev = $this->db->prepare("SELECT status, total_price, service_date, preferred_time, staff_id FROM reservations WHERE id = :id LIMIT 1");
        $stmtPrev->execute([':id' => $id]);
        $prev = $stmtPrev->fetch(PDO::FETCH_ASSOC);

        if (!$prev) return false;

        $previousStatus = $prev['status'];
        $finalPrice = $totalPrice !== null ? $totalPrice : $prev['total_price'];
        $finalDate = $serviceDate !== null ? $serviceDate : $prev['service_date'];
        $finalTime = $preferredTime !== null ? $preferredTime : $prev['preferred_time'];
        $finalStaff = $staffId !== null ? $staffId : $prev['staff_id'];

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
}
