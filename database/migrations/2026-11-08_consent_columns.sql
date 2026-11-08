-- Records proof of consent (Terms acceptance and optional SMS opt-in).
-- Run once in phpMyAdmin on the production database.
ALTER TABLE `reservations`
  ADD COLUMN `terms_accepted_at` DATETIME NULL DEFAULT NULL,
  ADD COLUMN `consent_ip` VARCHAR(45) NULL DEFAULT NULL;

ALTER TABLE `customers`
  ADD COLUMN `sms_consent_at` DATETIME NULL DEFAULT NULL;
