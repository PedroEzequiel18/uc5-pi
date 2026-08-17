import { Pool } from "pg";
import "dotenv/config";

// Connection string vem do .env - nunca escrita direto no código.
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL não encontrada. Confira se o arquivo .env existe e está configurado."
  );
}

// Pool de conexões reutilizáveis com o banco (mais rápido que abrir
// uma conexão nova a cada consulta).
export const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});

pool.on("error", (erro: Error) => {
  console.error("Erro inesperado no pool de conexões do banco:", erro);
});