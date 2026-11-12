<?php

declare(strict_types=1);

namespace App\Config;

final class Config
{
    private static ?array $values = null;

    private const DEFAULTS = [
        'APP_ENV'          => 'production',
        'APP_URL'          => 'https://cleaning.mutechlabs.com',            // where /api lives
        'SITE_URL'         => 'https://cleaning.mutechlabs.com/public',     // where the public pages live
        'APP_SECRET'       => '',
        'ALLOWED_ORIGINS'  => 'https://cleaning.mutechlabs.com,https://luxuriapure.com,https://www.luxuriapure.com',
        'TOKEN_TTL'        => 43200, // 12h for staff/admin sessions
        // All dates (48 h cancellation window, reminders, "date in the past" checks, email times)
        // use the local time of the service area: D.C., Maryland and Virginia.
        'TIMEZONE'         => 'America/New_York',

        'DB_HOST'          => 'localhost',
        'DB_NAME'          => '',
        'DB_USER'          => '',
        'DB_PASSWORD'      => '',

        'SMTP_HOST'        => 'smtp.gmail.com',
        'SMTP_PORT'        => 587,
        'SMTP_USER'        => '',
        'SMTP_PASSWORD'    => '',
        'SMTP_SECURE'      => 'tls',

        // Business identity used in emails and legal pages
        'BUSINESS_NAME'    => 'Luxuria Pure Cleaning Services',
        'BUSINESS_PHONE'   => '+1 (443) 535-7785',
        'BUSINESS_ADDRESS' => '',

        // Email roles (see README-SECURITY.md)
        'MAIL_FROM'          => 'no-reply@luxuriapure.com',  // sender of every automated email
        'MAIL_FROM_NAME'     => 'Luxuria Pure',
        'MAIL_REPLY_TO'      => 'bookings@luxuriapure.com',  // where customer replies land
        'MAIL_BOOKINGS'      => 'bookings@luxuriapure.com',  // internal: new booking alerts
        'MAIL_SUPPORT'       => 'info@luxuriapure.com',      // general contact shown to customers
        'MAIL_PRIVACY'       => 'privacy@luxuriapure.com',   // privacy / data requests
    ];

    public static function get(string $key, mixed $default = null): mixed
    {
        if (self::$values === null) {
            $file = __DIR__ . '/secrets.php';
            $fileValues = is_file($file) ? (require $file) : [];
            self::$values = array_merge(self::DEFAULTS, is_array($fileValues) ? $fileValues : []);
        }

        $env = getenv($key);
        if ($env !== false && $env !== '') {
            return $env;
        }

        return self::$values[$key] ?? $default;
    }

    public static function isProduction(): bool
    {
        return self::get('APP_ENV') === 'production';
    }
}

// Apply the business time zone as soon as the configuration is loaded
date_default_timezone_set((string)Config::get('TIMEZONE', 'America/New_York'));
