/**
 * Vitest global setup.
 * - Mock env for tests (so DB/Redis tests don't accidentally hit real infra).
 * - Add expect extensions.
 */
process.env.NODE_ENV ||= "test";
process.env.DATABASE_URL ||= "postgresql://postgres:test@localhost:5432/ecom_test?schema=public";
process.env.REDIS_URL ||= "redis://localhost:6379/15";
process.env.JWT_ADMIN_ACCESS_SECRET ||= "test_secret_admin_access_xxxxxxxxxxxxxxxxxxxxxxxx";
process.env.JWT_ADMIN_REFRESH_SECRET ||= "test_secret_admin_refresh_xxxxxxxxxxxxxxxxxxxxxxx";
process.env.JWT_CUSTOMER_ACCESS_SECRET ||= "test_secret_customer_access_xxxxxxxxxxxxxxxxxxxxx";
process.env.JWT_CUSTOMER_REFRESH_SECRET ||= "test_secret_customer_refresh_xxxxxxxxxxxxxxxxxx";
process.env.JWT_SUPER_ACCESS_SECRET ||= "test_secret_super_access_xxxxxxxxxxxxxxxxxxxxxxxx";
process.env.COOKIE_SECRET ||= "test_cookie_secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
process.env.APP_ENCRYPTION_KEY ||= "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
