// Set required env vars before any module is imported in tests
process.env.ENCRYPTION_KEY = "a".repeat(64); // 32 bytes of 0xaa — test-only key
process.env.API_TOKEN = "test-token";
process.env.WEBHOOK_SECRET = "test-webhook-secret";
