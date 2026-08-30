function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Copy apps/api/.env.example to apps/api/.env and fill it in.`,
    );
  }
  return value;
}

export const env = {
  databaseUrl: required('DATABASE_URL'),
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? '0.0.0.0',
  uploadDir: process.env.UPLOAD_DIR ?? './uploads',
  isProduction: process.env.NODE_ENV === 'production',
};
