process.env.JWT_SECRET = process.env.JWT_SECRET || 'secret-de-test';
process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = '1';
process.env.DB_USER = 'test';
process.env.DB_PASSWORD = 'test';
process.env.DB_NAME = 'test';
delete process.env.DATABASE_URL;
