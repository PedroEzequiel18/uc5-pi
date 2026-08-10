import { Pool } from "pg";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL não encontrada. Confira se o arquivo .env existe e está configurado."
  );
}

export const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});

pool.on("error", (erro: Error) => {
  console.error("Erro inesperado no pool de conexões do banco:", erro);
});