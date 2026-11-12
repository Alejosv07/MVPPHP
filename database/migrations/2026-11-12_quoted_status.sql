ALTER TABLE `reservations`
  MODIFY `status` enum('PENDING','QUOTED','CONFIRMED','INITIATED','ON_THE_WAY','RESCHEDULED','COMPLETED','CANCELLED','REJECTED')
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'PENDING';

ALTER TABLE `reservation_history`
  MODIFY `previous_status` enum('PENDING','QUOTED','CONFIRMED','INITIATED','ON_THE_WAY','RESCHEDULED','COMPLETED','CANCELLED','REJECTED')
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  MODIFY `new_status` enum('PENDING','QUOTED','CONFIRMED','INITIATED','ON_THE_WAY','RESCHEDULED','COMPLETED','CANCELLED','REJECTED')
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;

-- Existing requests that already have a price are quotes waiting for the customer
UPDATE `reservations` SET `status` = 'QUOTED' WHERE `status` = 'PENDING' AND `total_price` > 0;
