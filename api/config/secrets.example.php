<?php
/**
 * Copy this file to secrets.php (same folder) and fill in real values.
 * secrets.php is git-ignored and excluded from the FTP deploy:
 * upload it to the server manually ONCE (public_html/api/config/secrets.php).
 *
 * Generate APP_SECRET with:  php -r "echo bin2hex(random_bytes(32));"
 */
return [
    'APP_ENV'         => 'production',
    'APP_URL'         => 'https://cleaning.mutechlabs.com',
    'SITE_URL'        => 'https://cleaning.mutechlabs.com/public',
    'APP_SECRET'      => 'CHANGE_ME_64_HEX_CHARS',
    'ALLOWED_ORIGINS' => 'https://cleaning.mutechlabs.com,https://luxuriapure.com,https://www.luxuriapure.com',

    'DB_HOST'     => 'localhost',
    'DB_NAME'     => '',
    'DB_USER'     => '',
    'DB_PASSWORD' => '',

    // Use the SMTP account of the luxuriapure.com mailbox (recommended),
    // or a Gmail/Google Workspace App Password.
    'SMTP_HOST'     => 'smtp.gmail.com',
    'SMTP_PORT'     => 587,
    'SMTP_USER'     => '',
    'SMTP_PASSWORD' => '',
    'SMTP_SECURE'   => 'tls',

    'BUSINESS_ADDRESS' => '',

    'MAIL_FROM'      => 'no-reply@luxuriapure.com',
    'MAIL_FROM_NAME' => 'Luxuria Pure',
    'MAIL_REPLY_TO'  => 'bookings@luxuriapure.com',
    'MAIL_BOOKINGS'  => 'bookings@luxuriapure.com',
    'MAIL_SUPPORT'   => 'info@luxuriapure.com',
    'MAIL_PRIVACY'   => 'privacy@luxuriapure.com',
];
