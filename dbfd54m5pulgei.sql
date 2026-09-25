-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Sep 25, 2026 at 08:03 PM
-- Server version: 8.4.6-6
-- PHP Version: 8.2.34

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `dbfd54m5pulgei`
--

-- --------------------------------------------------------

--
-- Table structure for table `activity_logs`
--

CREATE TABLE `activity_logs` (
  `id` int NOT NULL,
  `user_id` int DEFAULT NULL,
  `action` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_id` int NOT NULL,
  `details` json DEFAULT NULL,
  `ip_address` varchar(45) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `activity_logs`
--

INSERT INTO `activity_logs` (`id`, `user_id`, `action`, `entity_type`, `entity_id`, `details`, `ip_address`, `created_at`) VALUES
(1, 1, 'CREATE', 'service_categories', 1, '{\"name\": \"Basic\", \"user_id\": 1}', '179.5.180.151', '2026-09-24 00:18:26'),
(2, 1, 'CREATE', 'services', 1, '{\"new_state\": {\"id\": 1, \"name\": \"Essential Clean\", \"features\": [{\"id\": 2, \"name\": \"Bathrooms (Sanitized)\"}, {\"id\": 3, \"name\": \"Bedrooms (Made & Dusted)\"}, {\"id\": 4, \"name\": \"Floors (Vacuum & Mop)\"}, {\"id\": 1, \"name\": \"Kitchen & Cabinets (Exterior)\"}, {\"id\": 6, \"name\": \"Light Switches & Fans\"}, {\"id\": 5, \"name\": \"Trash Cans (Washed)\"}], \"image_url\": \"/uploads/service_6ab47607077611.13440452.webp\", \"is_active\": 1, \"created_at\": \"2026-09-23 19:59:51\", \"updated_at\": \"2026-09-23 19:59:51\", \"category_id\": 1, \"description\": \"Consistent maintenance for your home. Covers all high-traffic areas with attention to detail.\", \"category_name\": \"Basic\", \"price_per_hour\": \"150.00\", \"estimated_duration_hours\": \"1.00\"}, \"feature_ids\": \"[\\\"2\\\",\\\"3\\\",\\\"4\\\",\\\"1\\\",\\\"6\\\",\\\"5\\\"]\"}', '179.5.180.151', '2026-09-24 00:59:51'),
(3, 1, 'UPDATE', 'services', 1, '{\"new_state\": {\"id\": 1, \"name\": \"Essential Clean\", \"features\": [{\"id\": 2, \"name\": \"Bathrooms (Sanitized)\"}, {\"id\": 3, \"name\": \"Bedrooms (Made & Dusted)\"}, {\"id\": 4, \"name\": \"Floors (Vacuum & Mop)\"}, {\"id\": 1, \"name\": \"Kitchen & Cabinets (Exterior)\"}, {\"id\": 6, \"name\": \"Light Switches & Fans\"}, {\"id\": 5, \"name\": \"Trash Cans (Washed)\"}], \"image_url\": \"/uploads/service_6ab4772eaf5913.68039686.webp\", \"is_active\": 1, \"created_at\": \"2026-09-23 19:59:51\", \"updated_at\": \"2026-09-23 20:04:46\", \"category_id\": 1, \"description\": \"Consistent maintenance for your home. Covers all high-traffic areas with attention to detail.\", \"category_name\": \"Basic\", \"price_per_hour\": \"150.00\", \"estimated_duration_hours\": \"1.00\"}, \"feature_ids\": \"[2,3,4,1,6,5]\", \"previous_state\": {\"id\": 1, \"name\": \"Essential Clean\", \"features\": [{\"id\": 2, \"name\": \"Bathrooms (Sanitized)\"}, {\"id\": 3, \"name\": \"Bedrooms (Made & Dusted)\"}, {\"id\": 4, \"name\": \"Floors (Vacuum & Mop)\"}, {\"id\": 1, \"name\": \"Kitchen & Cabinets (Exterior)\"}, {\"id\": 6, \"name\": \"Light Switches & Fans\"}, {\"id\": 5, \"name\": \"Trash Cans (Washed)\"}], \"image_url\": \"/uploads/service_6ab47607077611.13440452.webp\", \"is_active\": 1, \"created_at\": \"2026-09-23 19:59:51\", \"updated_at\": \"2026-09-23 19:59:51\", \"category_id\": 1, \"description\": \"Consistent maintenance for your home. Covers all high-traffic areas with attention to detail.\", \"category_name\": \"Basic\", \"price_per_hour\": \"150.00\", \"estimated_duration_hours\": \"1.00\"}}', '179.5.180.151', '2026-09-24 01:04:46'),
(4, 1, 'UPDATE', 'services', 1, '{\"new_state\": {\"id\": 1, \"name\": \"Essential Clean\", \"features\": [{\"id\": 2, \"name\": \"Bathrooms (Sanitized)\"}, {\"id\": 3, \"name\": \"Bedrooms (Made & Dusted)\"}, {\"id\": 4, \"name\": \"Floors (Vacuum & Mop)\"}, {\"id\": 1, \"name\": \"Kitchen & Cabinets (Exterior)\"}, {\"id\": 6, \"name\": \"Light Switches & Fans\"}, {\"id\": 5, \"name\": \"Trash Cans (Washed)\"}], \"image_url\": \"/uploads/service_6ab4779996dc00.54537100.webp\", \"is_active\": 1, \"created_at\": \"2026-09-23 19:59:51\", \"updated_at\": \"2026-09-23 20:06:33\", \"category_id\": 1, \"description\": \"Consistent maintenance for your home. Covers all high-traffic areas with attention to detail.\", \"category_name\": \"Basic\", \"price_per_hour\": \"150.00\", \"estimated_duration_hours\": \"1.00\"}, \"feature_ids\": \"[2,3,4,1,6,5]\", \"previous_state\": {\"id\": 1, \"name\": \"Essential Clean\", \"features\": [{\"id\": 2, \"name\": \"Bathrooms (Sanitized)\"}, {\"id\": 3, \"name\": \"Bedrooms (Made & Dusted)\"}, {\"id\": 4, \"name\": \"Floors (Vacuum & Mop)\"}, {\"id\": 1, \"name\": \"Kitchen & Cabinets (Exterior)\"}, {\"id\": 6, \"name\": \"Light Switches & Fans\"}, {\"id\": 5, \"name\": \"Trash Cans (Washed)\"}], \"image_url\": \"/uploads/service_6ab4772eaf5913.68039686.webp\", \"is_active\": 1, \"created_at\": \"2026-09-23 19:59:51\", \"updated_at\": \"2026-09-23 20:04:46\", \"category_id\": 1, \"description\": \"Consistent maintenance for your home. Covers all high-traffic areas with attention to detail.\", \"category_name\": \"Basic\", \"price_per_hour\": \"150.00\", \"estimated_duration_hours\": \"1.00\"}}', '179.5.180.151', '2026-09-24 01:06:33'),
(5, 1, 'UPDATE', 'services', 1, '{\"new_state\": {\"id\": 1, \"name\": \"Essential Clean\", \"features\": [{\"id\": 2, \"name\": \"Bathrooms (Sanitized)\"}, {\"id\": 3, \"name\": \"Bedrooms (Made & Dusted)\"}, {\"id\": 4, \"name\": \"Floors (Vacuum & Mop)\"}, {\"id\": 1, \"name\": \"Kitchen & Cabinets (Exterior)\"}, {\"id\": 6, \"name\": \"Light Switches & Fans\"}, {\"id\": 5, \"name\": \"Trash Cans (Washed)\"}], \"image_url\": \"/uploads/service_6ab477b8abfb14.47584846.webp\", \"is_active\": 1, \"created_at\": \"2026-09-23 19:59:51\", \"updated_at\": \"2026-09-23 20:07:04\", \"category_id\": 1, \"description\": \"Consistent maintenance for your home. Covers all high-traffic areas with attention to detail.\", \"category_name\": \"Basic\", \"price_per_hour\": \"150.00\", \"estimated_duration_hours\": \"1.00\"}, \"feature_ids\": \"[2,3,4,1,6,5]\", \"previous_state\": {\"id\": 1, \"name\": \"Essential Clean\", \"features\": [{\"id\": 2, \"name\": \"Bathrooms (Sanitized)\"}, {\"id\": 3, \"name\": \"Bedrooms (Made & Dusted)\"}, {\"id\": 4, \"name\": \"Floors (Vacuum & Mop)\"}, {\"id\": 1, \"name\": \"Kitchen & Cabinets (Exterior)\"}, {\"id\": 6, \"name\": \"Light Switches & Fans\"}, {\"id\": 5, \"name\": \"Trash Cans (Washed)\"}], \"image_url\": \"/uploads/service_6ab4779996dc00.54537100.webp\", \"is_active\": 1, \"created_at\": \"2026-09-23 19:59:51\", \"updated_at\": \"2026-09-23 20:06:33\", \"category_id\": 1, \"description\": \"Consistent maintenance for your home. Covers all high-traffic areas with attention to detail.\", \"category_name\": \"Basic\", \"price_per_hour\": \"150.00\", \"estimated_duration_hours\": \"1.00\"}}', '179.5.180.151', '2026-09-24 01:07:04'),
(6, 1, 'UPDATE', 'services', 1, '{\"new_state\": {\"id\": 1, \"name\": \"Essential Clean\", \"features\": [{\"id\": 2, \"name\": \"Bathrooms (Sanitized)\"}, {\"id\": 3, \"name\": \"Bedrooms (Made & Dusted)\"}, {\"id\": 4, \"name\": \"Floors (Vacuum & Mop)\"}, {\"id\": 1, \"name\": \"Kitchen & Cabinets (Exterior)\"}, {\"id\": 6, \"name\": \"Light Switches & Fans\"}, {\"id\": 5, \"name\": \"Trash Cans (Washed)\"}], \"image_url\": \"/uploads/service_6ab4790c69e0f2.28744822.webp\", \"is_active\": 1, \"created_at\": \"2026-09-23 19:59:51\", \"updated_at\": \"2026-09-23 20:12:44\", \"category_id\": 1, \"description\": \"Consistent maintenance for your home. Covers all high-traffic areas with attention to detail.\", \"category_name\": \"Basic\", \"price_per_hour\": \"150.00\", \"estimated_duration_hours\": \"1.00\"}, \"feature_ids\": \"[2,3,4,1,6,5]\", \"previous_state\": {\"id\": 1, \"name\": \"Essential Clean\", \"features\": [{\"id\": 2, \"name\": \"Bathrooms (Sanitized)\"}, {\"id\": 3, \"name\": \"Bedrooms (Made & Dusted)\"}, {\"id\": 4, \"name\": \"Floors (Vacuum & Mop)\"}, {\"id\": 1, \"name\": \"Kitchen & Cabinets (Exterior)\"}, {\"id\": 6, \"name\": \"Light Switches & Fans\"}, {\"id\": 5, \"name\": \"Trash Cans (Washed)\"}], \"image_url\": \"/uploads/service_6ab477b8abfb14.47584846.webp\", \"is_active\": 1, \"created_at\": \"2026-09-23 19:59:51\", \"updated_at\": \"2026-09-23 20:07:04\", \"category_id\": 1, \"description\": \"Consistent maintenance for your home. Covers all high-traffic areas with attention to detail.\", \"category_name\": \"Basic\", \"price_per_hour\": \"150.00\", \"estimated_duration_hours\": \"1.00\"}}', '179.5.180.151', '2026-09-24 01:12:44'),
(7, 1, 'UPDATE', 'services', 1, '{\"new_state\": {\"id\": 1, \"name\": \"Essential Clean\", \"features\": [{\"id\": 2, \"name\": \"Bathrooms (Sanitized)\"}, {\"id\": 3, \"name\": \"Bedrooms (Made & Dusted)\"}, {\"id\": 4, \"name\": \"Floors (Vacuum & Mop)\"}, {\"id\": 1, \"name\": \"Kitchen & Cabinets (Exterior)\"}, {\"id\": 6, \"name\": \"Light Switches & Fans\"}, {\"id\": 5, \"name\": \"Trash Cans (Washed)\"}], \"image_url\": \"/uploads/service_6ab47bfcc4e680.41524258.webp\", \"is_active\": 1, \"created_at\": \"2026-09-23 19:59:51\", \"updated_at\": \"2026-09-23 20:25:16\", \"category_id\": 1, \"description\": \"Consistent maintenance for your home. Covers all high-traffic areas with attention to detail.\", \"category_name\": \"Basic\", \"price_per_hour\": \"150.00\", \"estimated_duration_hours\": \"1.00\"}, \"feature_ids\": \"[2,3,4,1,6,5]\", \"previous_state\": {\"id\": 1, \"name\": \"Essential Clean\", \"features\": [{\"id\": 2, \"name\": \"Bathrooms (Sanitized)\"}, {\"id\": 3, \"name\": \"Bedrooms (Made & Dusted)\"}, {\"id\": 4, \"name\": \"Floors (Vacuum & Mop)\"}, {\"id\": 1, \"name\": \"Kitchen & Cabinets (Exterior)\"}, {\"id\": 6, \"name\": \"Light Switches & Fans\"}, {\"id\": 5, \"name\": \"Trash Cans (Washed)\"}], \"image_url\": \"/uploads/service_6ab4790c69e0f2.28744822.webp\", \"is_active\": 1, \"created_at\": \"2026-09-23 19:59:51\", \"updated_at\": \"2026-09-23 20:12:44\", \"category_id\": 1, \"description\": \"Consistent maintenance for your home. Covers all high-traffic areas with attention to detail.\", \"category_name\": \"Basic\", \"price_per_hour\": \"150.00\", \"estimated_duration_hours\": \"1.00\"}}', '179.5.180.151', '2026-09-24 01:25:16'),
(8, 1, 'CREATE', 'services', 2, '{\"new_state\": {\"id\": 2, \"name\": \"Signature Clean\", \"features\": [{\"id\": 7, \"name\": \"Oven Interior Cleaning\"}, {\"id\": 8, \"name\": \"Refrigerator Interior Cleaning\"}, {\"id\": 9, \"name\": \"Interior Windows\"}, {\"id\": 10, \"name\": \"Detailed Kitchen Care\"}], \"image_url\": \"/uploads/service_6ab47f7c788709.57712474.webp\", \"is_active\": 1, \"created_at\": \"2026-09-23 20:40:12\", \"updated_at\": \"2026-09-23 20:40:12\", \"category_id\": 1, \"description\": \"Our standard service for ongoing care. Includes detailed cleaning of the kitchen and appliances.\", \"category_name\": \"Basic\", \"price_per_hour\": \"210.00\", \"estimated_duration_hours\": \"1.00\"}, \"feature_ids\": \"[\\\"7\\\",\\\"8\\\",\\\"9\\\",\\\"10\\\"]\"}', '179.5.180.151', '2026-09-24 01:40:12'),
(9, 1, 'CREATE', 'services', 3, '{\"new_state\": {\"id\": 3, \"name\": \"Deep Clean\", \"features\": [{\"id\": 11, \"name\": \"Baseboards (Hand Washed)\"}, {\"id\": 12, \"name\": \"Blinds & Shades (Dusted)\"}, {\"id\": 13, \"name\": \"Porch (If applicable)\"}, {\"id\": 14, \"name\": \"Custom Requests\"}], \"image_url\": \"/uploads/service_6ab47ff22e3800.37356410.webp\", \"is_active\": 1, \"created_at\": \"2026-09-23 20:42:10\", \"updated_at\": \"2026-09-23 20:42:10\", \"category_id\": 1, \"description\": \"Recommended for initial visits or seasonal refreshing. A comprehensive reset for your home.\", \"category_name\": \"Basic\", \"price_per_hour\": \"300.00\", \"estimated_duration_hours\": \"1.00\"}, \"feature_ids\": \"[\\\"11\\\",\\\"12\\\",\\\"13\\\",\\\"14\\\"]\"}', '179.5.180.151', '2026-09-24 01:42:10'),
(10, 1, 'CREATE', 'reservations', 1, '{\"email\": \"balrking07@gmail.com\", \"status\": \"PENDING\", \"customer\": \"Alejandro Romero\", \"service_id\": 3}', '179.5.180.151', '2026-09-24 02:00:00'),
(11, 1, 'UPDATE', 'reservations', 1, '{\"comment\": \"Admin assigned/updated total price to $600.00\", \"staff_id\": null, \"new_status\": \"PENDING\", \"mutation_type\": \"STATUS_CHANGE_WITH_DETAILS\"}', '179.5.180.151', '2026-09-24 02:01:48'),
(12, 1, 'UPDATE', 'USER', 1, '{\"name\": \"Romero\", \"role\": \"ADMIN\", \"email\": \"balrking07@gmail.com\", \"is_active\": 1, \"logged_user_id\": 1}', '179.5.180.151', '2026-09-24 02:04:05'),
(13, 1, 'UPDATE', 'USER', 1, '{\"name\": \"Romero\", \"role\": \"ADMIN\", \"email\": \"balrking07@gmail.com\", \"password\": \"123\", \"is_active\": 1, \"logged_user_id\": 1}', '179.5.180.151', '2026-09-24 02:04:45'),
(14, 1, 'UPDATE', 'reservations', 1, '{\"comment\": \"Staff unassigned\", \"staff_id\": null, \"new_status\": \"PENDING\", \"mutation_type\": \"STATUS_CHANGE_WITH_DETAILS\"}', '179.51.3.220', '2026-09-24 06:05:33'),
(15, 1, 'CREATE', 'service_zones', 1, '{\"areas\": [\"Old Town\", \"Del Ray\", \"Rosemont\", \"Potomac Yard\", \"Eisenhower Valley\"], \"city_name\": \"Alexandria\"}', '179.5.180.151', '2026-09-24 20:38:53'),
(16, 1, 'CREATE', 'service_zones', 2, '{\"areas\": [\"Clarendon\", \"Ballston\", \"Rosslyn\", \"Crystal City\", \"Pentagon City\"], \"city_name\": \"Arlington\"}', '179.5.180.151', '2026-09-24 20:40:07'),
(17, 1, 'UPDATE', 'service_zones', 2, '{\"areas\": [\"Clarendon\", \"Ballston\", \"Rosslyn\", \"Crystal City\", \"Pentagon City\"], \"city_name\": \"Arlington\"}', '179.5.180.151', '2026-09-24 20:40:26'),
(18, 1, 'CREATE', 'service_zones', 3, '{\"areas\": [\"Georgetown\", \"Dupont Circle\", \"Kalorama\", \"Cleveland Park\", \"Tenleytown\", \"Friendship Heights\"], \"city_name\": \"Washington\"}', '179.5.180.151', '2026-09-24 20:42:54'),
(19, 1, 'CREATE', 'service_zones', 4, '{\"areas\": [\"Bethesda\", \"Chevy Chase\"], \"city_name\": \"Maryland\"}', '179.5.180.151', '2026-09-24 20:43:23'),
(20, 1, 'CREATE', 'USER', 2, '{\"email\": \"12@g.com\"}', '179.5.180.151', '2026-09-24 23:17:08'),
(21, 1, 'UPDATE', 'reservations', 1, '{\"comment\": \"Assigned staff ID 2\", \"staff_id\": 2, \"new_status\": \"PENDING\", \"mutation_type\": \"STATUS_CHANGE_WITH_DETAILS\"}', '179.5.180.151', '2026-09-24 23:31:37'),
(22, 1, 'UPDATE', 'USER', 2, '{\"name\": \"ale staff\", \"role\": \"STAFF\", \"email\": \"12@g.com\", \"password\": \"1\", \"is_active\": 1, \"logged_user_id\": 1}', '179.5.180.151', '2026-09-24 23:32:19'),
(23, 1, 'UPDATE', 'reservations', 1, '{\"comment\": \"Assigned staff ID 2\", \"staff_id\": 2, \"new_status\": \"PENDING\", \"mutation_type\": \"STATUS_CHANGE_WITH_DETAILS\"}', '179.5.180.151', '2026-09-24 23:40:21'),
(24, 1, 'UPDATE', 'reservations', 1, '{\"comment\": \"Assigned staff ID 2\", \"staff_id\": 2, \"new_status\": \"PENDING\", \"mutation_type\": \"STATUS_CHANGE_WITH_DETAILS\"}', '179.5.180.151', '2026-09-24 23:43:24'),
(25, NULL, 'UPDATE', 'reservations', 1, '{\"method\": \"EMAIL_ACTION_LINK\", \"new_status\": \"CONFIRMED\"}', '179.5.180.151', '2026-09-24 23:45:00'),
(26, 2, 'UPDATE', 'reservations', 1, '{\"comment\": \"Status updated via admin panel\", \"staff_id\": null, \"new_status\": \"COMPLETED\", \"mutation_type\": \"STATUS_CHANGE_WITH_DETAILS\"}', '179.5.180.151', '2026-09-24 23:46:01'),
(27, 2, 'UPDATE', 'reservations', 1, '{\"comment\": \"Status updated via admin panel\", \"staff_id\": null, \"new_status\": \"ON_THE_WAY\", \"mutation_type\": \"STATUS_CHANGE_WITH_DETAILS\"}', '179.5.180.151', '2026-09-24 23:51:28'),
(28, 2, 'UPDATE', 'reservations', 1, '{\"comment\": \"Status updated via admin panel\", \"staff_id\": null, \"new_status\": \"ON_THE_WAY\", \"mutation_type\": \"STATUS_CHANGE_WITH_DETAILS\"}', '179.5.180.151', '2026-09-24 23:55:40'),
(29, 2, 'UPDATE', 'reservations', 1, '{\"comment\": \"Status updated via admin panel\", \"staff_id\": null, \"new_status\": \"ON_THE_WAY\", \"mutation_type\": \"STATUS_CHANGE_WITH_DETAILS\"}', '179.5.180.151', '2026-09-24 23:56:18'),
(30, 2, 'UPDATE', 'reservations', 1, '{\"comment\": \"Status updated via admin panel\", \"staff_id\": null, \"new_status\": \"COMPLETED\", \"mutation_type\": \"STATUS_CHANGE_WITH_DETAILS\"}', '179.5.180.151', '2026-09-24 23:57:22'),
(31, 1, 'UPDATE', 'reservations', 1, '{\"comment\": \"Assigned staff ID 2\", \"staff_id\": 2, \"new_status\": \"PENDING\", \"mutation_type\": \"STATUS_CHANGE_WITH_DETAILS\"}', '179.5.180.151', '2026-09-25 00:04:22'),
(32, 1, 'UPDATE', 'reservations', 1, '{\"comment\": \"Assigned staff ID 2\", \"staff_id\": 2, \"new_status\": \"PENDING\", \"mutation_type\": \"STATUS_CHANGE_WITH_DETAILS\"}', '179.5.180.151', '2026-09-25 00:05:37'),
(33, 1, 'UPDATE', 'reservations', 1, '{\"comment\": \"Assigned staff ID 2\", \"staff_id\": 2, \"new_status\": \"PENDING\", \"mutation_type\": \"STATUS_CHANGE_WITH_DETAILS\"}', '179.5.180.151', '2026-09-25 00:11:51'),
(34, 1, 'UPDATE', 'reservations', 1, '{\"comment\": \"Assigned staff ID 2\", \"staff_id\": 2, \"new_status\": \"PENDING\", \"mutation_type\": \"STATUS_CHANGE_WITH_DETAILS\"}', '179.5.180.151', '2026-09-25 00:15:02'),
(35, 1, 'UPDATE', 'reservations', 1, '{\"comment\": \"Assigned staff ID 2\", \"staff_id\": 2, \"new_status\": \"PENDING\", \"mutation_type\": \"STATUS_CHANGE_WITH_DETAILS\"}', '179.5.180.151', '2026-09-25 00:15:19'),
(36, NULL, 'UPDATE', 'reservations', 1, '{\"method\": \"EMAIL_ACTION_LINK\", \"new_status\": \"CANCELLED\"}', '179.5.180.151', '2026-09-25 00:16:02'),
(37, NULL, 'UPDATE', 'reservations', 1, '{\"method\": \"EMAIL_ACTION_LINK\", \"new_status\": \"CONFIRMED\"}', '179.5.180.151', '2026-09-25 00:16:12'),
(38, 1, 'UPDATE', 'reservations', 1, '{\"comment\": \"Assigned staff ID 2\", \"staff_id\": 2, \"new_status\": \"CONFIRMED\", \"mutation_type\": \"STATUS_CHANGE_WITH_DETAILS\"}', '179.5.180.151', '2026-09-25 00:20:56'),
(39, 1, 'UPDATE', 'reservations', 1, '{\"comment\": \"Assigned staff ID 2\", \"staff_id\": 2, \"new_status\": \"CONFIRMED\", \"mutation_type\": \"STATUS_CHANGE_WITH_DETAILS\"}', '179.5.180.151', '2026-09-25 00:23:27'),
(40, 1, 'UPDATE', 'reservations', 1, '{\"comment\": \"Assigned staff ID 2\", \"staff_id\": 2, \"new_status\": \"CONFIRMED\", \"mutation_type\": \"STATUS_CHANGE_WITH_DETAILS\"}', '179.5.180.151', '2026-09-25 00:23:44'),
(41, 1, 'UPDATE', 'reservations', 1, '{\"comment\": \"Assigned staff ID 2\", \"staff_id\": 2, \"new_status\": \"RESCHEDULED\", \"mutation_type\": \"STATUS_CHANGE_WITH_DETAILS\"}', '179.5.180.151', '2026-09-25 00:27:09'),
(42, 2, 'UPDATE', 'reservations', 1, '{\"comment\": \"Status updated via admin panel\", \"staff_id\": null, \"new_status\": \"ON_THE_WAY\", \"mutation_type\": \"STATUS_CHANGE_WITH_DETAILS\"}', '179.5.180.151', '2026-09-25 00:28:42'),
(43, 2, 'UPDATE', 'reservations', 1, '{\"comment\": \"Status updated via admin panel\", \"staff_id\": null, \"new_status\": \"INITIATED\", \"mutation_type\": \"STATUS_CHANGE_WITH_DETAILS\"}', '179.5.180.151', '2026-09-25 00:29:01'),
(44, 2, 'UPDATE', 'reservations', 1, '{\"comment\": \"Status updated via admin panel\", \"staff_id\": null, \"new_status\": \"COMPLETED\", \"mutation_type\": \"STATUS_CHANGE_WITH_DETAILS\"}', '179.5.180.151', '2026-09-25 00:29:17'),
(45, 1, 'UPDATE', 'reservations', 1, '{\"comment\": \"Assigned staff ID 2\", \"staff_id\": 2, \"new_status\": \"PENDING\", \"mutation_type\": \"STATUS_CHANGE_WITH_DETAILS\"}', '179.5.180.151', '2026-09-25 00:34:53'),
(46, 2, 'UPDATE', 'reservations', 1, '{\"comment\": \"Status updated via admin panel\", \"staff_id\": null, \"new_status\": \"ON_THE_WAY\", \"mutation_type\": \"STATUS_CHANGE_WITH_DETAILS\"}', '179.5.180.151', '2026-09-25 00:36:52'),
(47, 2, 'UPDATE', 'reservations', 1, '{\"comment\": \"Status updated via admin panel\", \"staff_id\": null, \"new_status\": \"COMPLETED\", \"mutation_type\": \"STATUS_CHANGE_WITH_DETAILS\"}', '179.5.180.151', '2026-09-25 00:37:25'),
(48, 1, 'UPDATE', 'reservations', 1, '{\"comment\": \"Assigned staff ID 2\", \"staff_id\": 2, \"new_status\": \"PENDING\", \"mutation_type\": \"STATUS_CHANGE_WITH_DETAILS\"}', '179.5.180.151', '2026-09-25 00:40:32'),
(49, 1, 'UPDATE', 'reservations', 1, '{\"comment\": \"Assigned staff ID 2\", \"staff_id\": 2, \"new_status\": \"PENDING\", \"mutation_type\": \"STATUS_CHANGE_WITH_DETAILS\"}', '179.5.180.151', '2026-09-25 00:43:01'),
(50, 2, 'UPDATE', 'reservations', 1, '{\"comment\": \"Status updated via admin panel\", \"staff_id\": null, \"new_status\": \"COMPLETED\", \"mutation_type\": \"STATUS_CHANGE_WITH_DETAILS\"}', '179.5.180.151', '2026-09-25 00:43:47'),
(51, 1, 'UPDATE', 'system_settings', 0, '{\"new_schedule\": {\"user_id\": 1, \"global_blocked_days\": [], \"global_block_time_end\": \"\", \"blocked_specific_dates\": [\"2026-09-09\"], \"global_block_time_start\": \"\"}}', '179.5.180.151', '2026-09-25 16:44:10'),
(52, 1, 'UPDATE', 'system_settings', 0, '{\"new_schedule\": {\"user_id\": 1, \"global_blocked_days\": [], \"global_block_time_end\": \"\", \"blocked_specific_dates\": [], \"global_block_time_start\": \"\"}}', '179.5.180.151', '2026-09-25 17:19:52');

-- --------------------------------------------------------

--
-- Table structure for table `customers`
--

CREATE TABLE `customers` (
  `id` int NOT NULL,
  `first_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone_number` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `otp_code` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `otp_expires_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `customers`
--

INSERT INTO `customers` (`id`, `first_name`, `last_name`, `email`, `phone_number`, `created_at`, `updated_at`, `otp_code`, `otp_expires_at`) VALUES
(1, 'Alejandro', 'Romero', 'balrking07@gmail.com', '12345678', '2026-09-24 02:00:00', '2026-09-25 18:03:55', NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `features`
--

CREATE TABLE `features` (
  `id` int NOT NULL,
  `name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `features`
--

INSERT INTO `features` (`id`, `name`, `created_at`) VALUES
(1, 'Kitchen & Cabinets (Exterior)', '2026-09-24 00:46:06'),
(2, 'Bathrooms (Sanitized)', '2026-09-24 00:55:32'),
(3, 'Bedrooms (Made & Dusted)', '2026-09-24 00:57:08'),
(4, 'Floors (Vacuum & Mop)', '2026-09-24 00:57:19'),
(5, 'Trash Cans (Washed)', '2026-09-24 00:58:20'),
(6, 'Light Switches & Fans', '2026-09-24 00:58:31'),
(7, 'Oven Interior Cleaning', '2026-09-24 01:38:47'),
(8, 'Refrigerator Interior Cleaning', '2026-09-24 01:39:06'),
(9, 'Interior Windows', '2026-09-24 01:39:14'),
(10, 'Detailed Kitchen Care', '2026-09-24 01:39:21'),
(11, 'Baseboards (Hand Washed)', '2026-09-24 01:40:55'),
(12, 'Blinds & Shades (Dusted)', '2026-09-24 01:41:01'),
(13, 'Porch (If applicable)', '2026-09-24 01:41:08'),
(14, 'Custom Requests', '2026-09-24 01:41:15');

-- --------------------------------------------------------

--
-- Table structure for table `reservations`
--

CREATE TABLE `reservations` (
  `id` int NOT NULL,
  `customer_id` int NOT NULL,
  `service_id` int NOT NULL,
  `staff_id` int DEFAULT NULL,
  `service_date` date NOT NULL,
  `preferred_time` time NOT NULL,
  `service_address` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `frequency` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'One-time',
  `total_price` decimal(10,2) DEFAULT '0.00',
  `special_instructions` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `status` enum('PENDING','CONFIRMED','INITIATED','ON_THE_WAY','RESCHEDULED','COMPLETED','CANCELLED','REJECTED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'PENDING',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `bedrooms` int DEFAULT '1',
  `bathrooms` decimal(3,1) DEFAULT '1.0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `reservations`
--

INSERT INTO `reservations` (`id`, `customer_id`, `service_id`, `staff_id`, `service_date`, `preferred_time`, `service_address`, `frequency`, `total_price`, `special_instructions`, `status`, `created_at`, `updated_at`, `bedrooms`, `bathrooms`) VALUES
(1, 1, 3, 2, '2026-09-30', '22:59:00', 'Los Angeles', 'One-time', 600.00, 'Booked via public site. Frequency: One-time', 'COMPLETED', '2026-09-24 02:00:00', '2026-09-25 00:43:47', 1, 1.0);

-- --------------------------------------------------------

--
-- Table structure for table `reservation_history`
--

CREATE TABLE `reservation_history` (
  `id` int NOT NULL,
  `reservation_id` int NOT NULL,
  `user_id` int DEFAULT NULL,
  `previous_status` enum('PENDING','CONFIRMED','INITIATED','ON_THE_WAY','RESCHEDULED','COMPLETED','CANCELLED','REJECTED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `new_status` enum('PENDING','CONFIRMED','INITIATED','ON_THE_WAY','RESCHEDULED','COMPLETED','CANCELLED','REJECTED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `comment` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `reservation_history`
--

INSERT INTO `reservation_history` (`id`, `reservation_id`, `user_id`, `previous_status`, `new_status`, `comment`, `created_at`) VALUES
(1, 1, 1, NULL, 'PENDING', 'Reservation created successfully.', '2026-09-24 02:00:00'),
(2, 1, 1, 'PENDING', 'PENDING', 'Admin assigned/updated total price to $600.00', '2026-09-24 02:01:48'),
(3, 1, 1, 'PENDING', 'PENDING', 'Staff unassigned', '2026-09-24 06:05:33'),
(4, 1, 1, 'PENDING', 'PENDING', 'Assigned staff ID 2', '2026-09-24 23:31:37'),
(5, 1, 1, 'PENDING', 'PENDING', 'Assigned staff ID 2', '2026-09-24 23:40:21'),
(6, 1, 1, 'PENDING', 'PENDING', 'Assigned staff ID 2', '2026-09-24 23:43:24'),
(7, 1, NULL, 'PENDING', 'CONFIRMED', 'Actualizado a CONFIRMED vía enlace de correo', '2026-09-24 23:45:00'),
(8, 1, 2, 'CONFIRMED', 'COMPLETED', 'Status updated via admin panel', '2026-09-24 23:46:01'),
(9, 1, 2, 'CONFIRMED', 'ON_THE_WAY', 'Status updated via admin panel', '2026-09-24 23:51:28'),
(10, 1, 2, 'ON_THE_WAY', 'ON_THE_WAY', 'Status updated via admin panel', '2026-09-24 23:55:40'),
(11, 1, 2, 'ON_THE_WAY', 'ON_THE_WAY', 'Status updated via admin panel', '2026-09-24 23:56:18'),
(12, 1, 2, 'ON_THE_WAY', 'COMPLETED', 'Status updated via admin panel', '2026-09-24 23:57:22'),
(13, 1, 1, 'PENDING', 'PENDING', 'Assigned staff ID 2', '2026-09-25 00:04:22'),
(14, 1, 1, 'PENDING', 'PENDING', 'Assigned staff ID 2', '2026-09-25 00:05:37'),
(15, 1, 1, 'PENDING', 'PENDING', 'Assigned staff ID 2', '2026-09-25 00:11:51'),
(16, 1, 1, 'PENDING', 'PENDING', 'Assigned staff ID 2', '2026-09-25 00:15:02'),
(17, 1, 1, 'PENDING', 'PENDING', 'Assigned staff ID 2', '2026-09-25 00:15:19'),
(18, 1, NULL, 'PENDING', 'CANCELLED', 'Status updated to CANCELLED via email link', '2026-09-25 00:16:02'),
(19, 1, NULL, 'CANCELLED', 'CONFIRMED', 'Status updated to CONFIRMED via email link', '2026-09-25 00:16:12'),
(20, 1, 1, 'CONFIRMED', 'CONFIRMED', 'Assigned staff ID 2', '2026-09-25 00:20:56'),
(21, 1, 1, 'CONFIRMED', 'CONFIRMED', 'Assigned staff ID 2', '2026-09-25 00:23:27'),
(22, 1, 1, 'CONFIRMED', 'CONFIRMED', 'Assigned staff ID 2', '2026-09-25 00:23:44'),
(23, 1, NULL, 'CONFIRMED', 'RESCHEDULED', 'Service date rescheduled to 2026-09-30 by customer via email link.', '2026-09-25 00:23:58'),
(24, 1, 1, 'RESCHEDULED', 'RESCHEDULED', 'Assigned staff ID 2', '2026-09-25 00:27:09'),
(25, 1, NULL, 'RESCHEDULED', 'RESCHEDULED', 'Service date rescheduled to 2026-09-29 by customer via email link.', '2026-09-25 00:27:23'),
(26, 1, NULL, 'RESCHEDULED', 'CONFIRMED', 'Status updated to CONFIRMED by customer via email link.', '2026-09-25 00:28:04'),
(27, 1, 2, 'CONFIRMED', 'ON_THE_WAY', 'Status updated via admin panel', '2026-09-25 00:28:42'),
(28, 1, 2, 'ON_THE_WAY', 'INITIATED', 'Status updated via admin panel', '2026-09-25 00:29:01'),
(29, 1, 2, 'INITIATED', 'COMPLETED', 'Status updated via admin panel', '2026-09-25 00:29:17'),
(30, 1, 1, 'PENDING', 'PENDING', 'Assigned staff ID 2', '2026-09-25 00:34:53'),
(31, 1, NULL, 'PENDING', 'CONFIRMED', 'Status updated to CONFIRMED by customer via email link.', '2026-09-25 00:35:04'),
(32, 1, NULL, 'CONFIRMED', 'CANCELLED', 'Status updated to CANCELLED by customer via email link.', '2026-09-25 00:35:08'),
(33, 1, NULL, 'CANCELLED', 'RESCHEDULED', 'Service date rescheduled to 2026-09-30 by customer via email link.', '2026-09-25 00:36:37'),
(34, 1, 2, 'RESCHEDULED', 'ON_THE_WAY', 'Status updated via admin panel', '2026-09-25 00:36:52'),
(35, 1, 2, 'ON_THE_WAY', 'COMPLETED', 'Status updated via admin panel', '2026-09-25 00:37:25'),
(36, 1, 1, 'PENDING', 'PENDING', 'Assigned staff ID 2', '2026-09-25 00:40:32'),
(37, 1, 1, 'PENDING', 'PENDING', 'Assigned staff ID 2', '2026-09-25 00:43:01'),
(38, 1, NULL, 'PENDING', 'CONFIRMED', 'Status updated to CONFIRMED by customer via email link.', '2026-09-25 00:43:11'),
(39, 1, 2, 'CONFIRMED', 'COMPLETED', 'Status updated via admin panel', '2026-09-25 00:43:47');

-- --------------------------------------------------------

--
-- Table structure for table `reservation_ratings`
--

CREATE TABLE `reservation_ratings` (
  `id` int NOT NULL,
  `reservation_id` int NOT NULL,
  `staff_rating` tinyint DEFAULT NULL COMMENT 'Staff rating for the customer (1-5)',
  `staff_notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'Notes left by the staff regarding the service or customer',
  `customer_rating` tinyint DEFAULT NULL COMMENT 'Customer rating for the staff (1-5)',
  `customer_notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'Feedback or comments from the customer',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `reservation_ratings`
--

INSERT INTO `reservation_ratings` (`id`, `reservation_id`, `staff_rating`, `staff_notes`, `customer_rating`, `customer_notes`, `created_at`, `updated_at`) VALUES
(1, 1, 4, 'Was good', 4, 'It was really good!', '2026-09-24 23:46:04', '2026-09-25 00:44:16');

-- --------------------------------------------------------

--
-- Table structure for table `services`
--

CREATE TABLE `services` (
  `id` int NOT NULL,
  `category_id` int NOT NULL,
  `name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `price_per_hour` decimal(10,2) NOT NULL DEFAULT '0.00',
  `estimated_duration_hours` decimal(4,2) NOT NULL DEFAULT '1.00',
  `image_url` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `services`
--

INSERT INTO `services` (`id`, `category_id`, `name`, `description`, `price_per_hour`, `estimated_duration_hours`, `image_url`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 1, 'Essential Clean', 'Consistent maintenance for your home. Covers all high-traffic areas with attention to detail.', 150.00, 1.00, '/uploads/service_6ab47bfcc4e680.41524258.webp', 1, '2026-09-24 00:59:51', '2026-09-24 01:25:16'),
(2, 1, 'Signature Clean', 'Our standard service for ongoing care. Includes detailed cleaning of the kitchen and appliances.', 210.00, 1.00, '/uploads/service_6ab47f7c788709.57712474.webp', 1, '2026-09-24 01:40:12', '2026-09-24 01:40:12'),
(3, 1, 'Deep Clean', 'Recommended for initial visits or seasonal refreshing. A comprehensive reset for your home.', 300.00, 1.00, '/uploads/service_6ab47ff22e3800.37356410.webp', 1, '2026-09-24 01:42:10', '2026-09-24 01:42:10');

-- --------------------------------------------------------

--
-- Table structure for table `service_categories`
--

CREATE TABLE `service_categories` (
  `id` int NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `service_categories`
--

INSERT INTO `service_categories` (`id`, `name`, `description`, `is_active`, `created_at`) VALUES
(1, 'Basic', NULL, 1, '2026-09-24 00:18:26');

-- --------------------------------------------------------

--
-- Table structure for table `service_features`
--

CREATE TABLE `service_features` (
  `id` int NOT NULL,
  `service_id` int NOT NULL,
  `feature_text` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `display_order` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `service_feature_relations`
--

CREATE TABLE `service_feature_relations` (
  `service_id` int NOT NULL,
  `feature_id` int NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `service_feature_relations`
--

INSERT INTO `service_feature_relations` (`service_id`, `feature_id`) VALUES
(1, 1),
(1, 2),
(1, 3),
(1, 4),
(1, 5),
(1, 6),
(2, 7),
(2, 8),
(2, 9),
(2, 10),
(3, 11),
(3, 12),
(3, 13),
(3, 14);

-- --------------------------------------------------------

--
-- Table structure for table `service_zones`
--

CREATE TABLE `service_zones` (
  `id` int NOT NULL,
  `city_name` varchar(100) NOT NULL,
  `state_code` varchar(10) NOT NULL DEFAULT 'VA',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `service_zones`
--

INSERT INTO `service_zones` (`id`, `city_name`, `state_code`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 'Alexandria', 'VA', 1, '2026-09-24 20:38:53', '2026-09-24 20:38:53'),
(2, 'Arlington', 'VA', 1, '2026-09-24 20:40:07', '2026-09-24 20:40:07'),
(3, 'Washington', 'DC', 1, '2026-09-24 20:42:54', '2026-09-24 20:42:54'),
(4, 'Maryland', '-', 1, '2026-09-24 20:43:23', '2026-09-24 20:43:23');

-- --------------------------------------------------------

--
-- Table structure for table `service_zone_areas`
--

CREATE TABLE `service_zone_areas` (
  `id` int NOT NULL,
  `zone_id` int NOT NULL,
  `area_name` varchar(100) NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `service_zone_areas`
--

INSERT INTO `service_zone_areas` (`id`, `zone_id`, `area_name`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 1, 'Old Town', 1, '2026-09-24 20:38:53', '2026-09-24 20:38:53'),
(2, 1, 'Del Ray', 1, '2026-09-24 20:38:53', '2026-09-24 20:38:53'),
(3, 1, 'Rosemont', 1, '2026-09-24 20:38:53', '2026-09-24 20:38:53'),
(4, 1, 'Potomac Yard', 1, '2026-09-24 20:38:53', '2026-09-24 20:38:53'),
(5, 1, 'Eisenhower Valley', 1, '2026-09-24 20:38:53', '2026-09-24 20:38:53'),
(11, 2, 'Clarendon', 1, '2026-09-24 20:40:26', '2026-09-24 20:40:26'),
(12, 2, 'Ballston', 1, '2026-09-24 20:40:26', '2026-09-24 20:40:26'),
(13, 2, 'Rosslyn', 1, '2026-09-24 20:40:26', '2026-09-24 20:40:26'),
(14, 2, 'Crystal City', 1, '2026-09-24 20:40:26', '2026-09-24 20:40:26'),
(15, 2, 'Pentagon City', 1, '2026-09-24 20:40:26', '2026-09-24 20:40:26'),
(16, 3, 'Georgetown', 1, '2026-09-24 20:42:54', '2026-09-24 20:42:54'),
(17, 3, 'Dupont Circle', 1, '2026-09-24 20:42:54', '2026-09-24 20:42:54'),
(18, 3, 'Kalorama', 1, '2026-09-24 20:42:54', '2026-09-24 20:42:54'),
(19, 3, 'Cleveland Park', 1, '2026-09-24 20:42:54', '2026-09-24 20:42:54'),
(20, 3, 'Tenleytown', 1, '2026-09-24 20:42:54', '2026-09-24 20:42:54'),
(21, 3, 'Friendship Heights', 1, '2026-09-24 20:42:54', '2026-09-24 20:42:54'),
(22, 4, 'Bethesda', 1, '2026-09-24 20:43:23', '2026-09-24 20:43:23'),
(23, 4, 'Chevy Chase', 1, '2026-09-24 20:43:23', '2026-09-24 20:43:23');

-- --------------------------------------------------------

--
-- Table structure for table `system_settings`
--

CREATE TABLE `system_settings` (
  `id` int NOT NULL,
  `setting_key` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `setting_value` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `system_settings`
--

INSERT INTO `system_settings` (`id`, `setting_key`, `setting_value`, `updated_at`) VALUES
(1, 'global_blocked_days', '[]', '2026-09-25 16:44:10'),
(2, 'global_block_time_start', '', '2026-09-25 16:44:10'),
(3, 'global_block_time_end', '', '2026-09-25 16:44:10'),
(4, 'blocked_specific_dates', '[]', '2026-09-25 17:19:52'),
(5, 'user_id', '1', '2026-09-25 16:44:10');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int NOT NULL,
  `name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('ADMIN','STAFF') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ADMIN',
  `reset_code` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reset_expires_at` datetime DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `name`, `email`, `password`, `role`, `reset_code`, `reset_expires_at`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 'Romero', 'balrking07@gmail.com', '$2y$10$3Zho80oJjyrD8XrVrd0jJuzheYbYo4nQKrcJ2RrWSWRFFTN1V1NKa', 'ADMIN', NULL, NULL, 1, '2026-09-23 23:44:43', '2026-09-24 02:04:45'),
(2, 'ale staff', '12@g.com', '$2y$10$cth3yu8KLUfVQ3k8WxowuOMoe1GBVdW3cR1pkbb56Te/9Qgy6u6dy', 'STAFF', NULL, NULL, 1, '2026-09-24 23:17:08', '2026-09-24 23:32:19');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `activity_logs`
--
ALTER TABLE `activity_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_logs_user` (`user_id`),
  ADD KEY `idx_logs_entity` (`entity_type`,`entity_id`);

--
-- Indexes for table `customers`
--
ALTER TABLE `customers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `idx_customers_email` (`email`);

--
-- Indexes for table `features`
--
ALTER TABLE `features`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indexes for table `reservations`
--
ALTER TABLE `reservations`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_reservations_customer` (`customer_id`),
  ADD KEY `fk_reservations_service` (`service_id`),
  ADD KEY `idx_reservations_status` (`status`),
  ADD KEY `idx_reservations_date` (`service_date`),
  ADD KEY `fk_reservations_staff` (`staff_id`);

--
-- Indexes for table `reservation_history`
--
ALTER TABLE `reservation_history`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_reshist_user` (`user_id`),
  ADD KEY `idx_reshist_reservation` (`reservation_id`);

--
-- Indexes for table `reservation_ratings`
--
ALTER TABLE `reservation_ratings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `idx_reservation_unique` (`reservation_id`);

--
-- Indexes for table `services`
--
ALTER TABLE `services`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_services_category` (`category_id`);

--
-- Indexes for table `service_categories`
--
ALTER TABLE `service_categories`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indexes for table `service_features`
--
ALTER TABLE `service_features`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_service_features_service` (`service_id`);

--
-- Indexes for table `service_feature_relations`
--
ALTER TABLE `service_feature_relations`
  ADD PRIMARY KEY (`service_id`,`feature_id`),
  ADD KEY `fk_sfr_feature` (`feature_id`);

--
-- Indexes for table `service_zones`
--
ALTER TABLE `service_zones`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `service_zone_areas`
--
ALTER TABLE `service_zone_areas`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_zone` (`zone_id`);

--
-- Indexes for table `system_settings`
--
ALTER TABLE `system_settings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `idx_setting_key` (`setting_key`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `idx_users_email` (`email`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `activity_logs`
--
ALTER TABLE `activity_logs`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=53;

--
-- AUTO_INCREMENT for table `customers`
--
ALTER TABLE `customers`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `features`
--
ALTER TABLE `features`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=15;

--
-- AUTO_INCREMENT for table `reservations`
--
ALTER TABLE `reservations`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `reservation_history`
--
ALTER TABLE `reservation_history`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=40;

--
-- AUTO_INCREMENT for table `reservation_ratings`
--
ALTER TABLE `reservation_ratings`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `services`
--
ALTER TABLE `services`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `service_categories`
--
ALTER TABLE `service_categories`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `service_features`
--
ALTER TABLE `service_features`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `service_zones`
--
ALTER TABLE `service_zones`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `service_zone_areas`
--
ALTER TABLE `service_zone_areas`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=24;

--
-- AUTO_INCREMENT for table `system_settings`
--
ALTER TABLE `system_settings`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `activity_logs`
--
ALTER TABLE `activity_logs`
  ADD CONSTRAINT `fk_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `reservations`
--
ALTER TABLE `reservations`
  ADD CONSTRAINT `fk_reservations_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_reservations_service` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_reservations_staff` FOREIGN KEY (`staff_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `reservation_history`
--
ALTER TABLE `reservation_history`
  ADD CONSTRAINT `fk_reshist_reservation` FOREIGN KEY (`reservation_id`) REFERENCES `reservations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_reshist_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `reservation_ratings`
--
ALTER TABLE `reservation_ratings`
  ADD CONSTRAINT `fk_ratings_reservation` FOREIGN KEY (`reservation_id`) REFERENCES `reservations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `services`
--
ALTER TABLE `services`
  ADD CONSTRAINT `fk_services_category` FOREIGN KEY (`category_id`) REFERENCES `service_categories` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

--
-- Constraints for table `service_features`
--
ALTER TABLE `service_features`
  ADD CONSTRAINT `fk_service_features_service` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `service_feature_relations`
--
ALTER TABLE `service_feature_relations`
  ADD CONSTRAINT `fk_sfr_feature` FOREIGN KEY (`feature_id`) REFERENCES `features` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_sfr_service` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `service_zone_areas`
--
ALTER TABLE `service_zone_areas`
  ADD CONSTRAINT `fk_zone` FOREIGN KEY (`zone_id`) REFERENCES `service_zones` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
