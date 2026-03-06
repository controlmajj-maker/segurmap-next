import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  // Configuración para Vercel Serverless — evita agotamiento del pool
  max: 1,                    // 1 conexión por función serverless
  idleTimeoutMillis: 10000,  // liberar conexión idle a los 10s
  connectionTimeoutMillis: 10000, // timeout de conexión 10s
});

export default pool;
