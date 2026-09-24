<?php

declare(strict_types=1);

namespace App\Models;

use App\Config\Database;
use PDO;

class ServiceZoneModel
{
    private PDO $db;

    public function __construct()
    {
        $this->db = (new Database())->getConnection();
    }

    public function getAll(): array
    {
        $stmt = $this->db->query("
            SELECT z.*, 
                   (SELECT COUNT(*) FROM service_zone_areas a WHERE a.zone_id = z.id) as areas_count 
            FROM service_zones z 
            ORDER BY z.id DESC
        ");
        $zones = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($zones as &$zone) {
            $zone['areas'] = $this->getAreasByZoneId((int)$zone['id']);
        }

        return $zones;
    }

    public function getById(int $id): ?array
    {
        $stmt = $this->db->prepare("SELECT * FROM service_zones WHERE id = :id LIMIT 1");
        $stmt->execute([':id' => $id]);
        $zone = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($zone) {
            $zone['areas'] = $this->getAreasByZoneId($id);
            return $zone;
        }

        return null;
    }

    public function getAreasByZoneId(int $zoneId): array
    {
        $stmt = $this->db->prepare("SELECT * FROM service_zone_areas WHERE zone_id = :zone_id ORDER BY id ASC");
        $stmt->execute([':zone_id' => $zoneId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function create(array $data): int
    {
        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare("
                INSERT INTO service_zones (city_name, state_code, is_active) 
                VALUES (:city_name, :state_code, :is_active)
            ");
            $stmt->execute([
                ':city_name'  => $data['city_name'],
                ':state_code' => $data['state_code'] ?? 'VA',
                ':is_active'  => $data['is_active'] ?? 1
            ]);
            $zoneId = (int)$this->db->lastInsertId();

            if (!empty($data['areas']) && is_array($data['areas'])) {
                $this->saveAreas($zoneId, $data['areas']);
            }

            $this->db->commit();
            return $zoneId;
        } catch (\Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    public function update(int $id, array $data): bool
    {
        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare("
                UPDATE service_zones 
                SET city_name = :city_name, state_code = :state_code, is_active = :is_active 
                WHERE id = :id
            ");
            $stmt->execute([
                ':city_name'  => $data['city_name'],
                ':state_code' => $data['state_code'] ?? 'VA',
                ':is_active'  => $data['is_active'] ?? 1,
                ':id'         => $id
            ]);

            $stmtDel = $this->db->prepare("DELETE FROM service_zone_areas WHERE zone_id = :zone_id");
            $stmtDel->execute([':zone_id' => $id]);

            if (!empty($data['areas']) && is_array($data['areas'])) {
                $this->saveAreas($id, $data['areas']);
            }

            $this->db->commit();
            return true;
        } catch (\Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    public function delete(int $id): bool
    {
        $stmt = $this->db->prepare("DELETE FROM service_zones WHERE id = :id");
        return $stmt->execute([':id' => $id]);
    }

    private function saveAreas(int $zoneId, array $areas): void
    {
        $stmtArea = $this->db->prepare("
            INSERT INTO service_zone_areas (zone_id, area_name, is_active) 
            VALUES (:zone_id, :area_name, 1)
        ");
        foreach ($areas as $areaName) {
            if (trim($areaName) !== '') {
                $stmtArea->execute([
                    ':zone_id'   => $zoneId,
                    ':area_name' => trim($areaName)
                ]);
            }
        }
    }

    public function getActiveZonesAndAreas(): array
    {
        $stmt = $this->db->query("
            SELECT z.city_name, a.area_name 
            FROM service_zones z
            JOIN service_zone_areas a ON z.id = a.zone_id
            WHERE z.is_active = 1 AND a.is_active = 1
        ");
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}