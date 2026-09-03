import { Pool } from "pg";
import dotenv from "dotenv";
import path from "path";
import { app } from "electron";

// No app empacotado o .env não fica na raiz do projeto, e sim em
// "resources" (colocado ali pelo electron-builder). Precisa rodar
// antes de qualquer leitura de DATABASE_URL.
dotenv.config(
  app.isPackaged ? { path: path.join(process.resourcesPath, ".env") } : undefined,
);

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL não encontrada. Confira se o arquivo .env existe e está configurado.",
  );
}

// Pool mantém conexões já abertas com o banco, evitando abrir/fechar
// uma conexão nova a cada consulta.
export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

pool.on("error", (erro: Error) => {
  console.error("Erro inesperado no pool de conexões do banco:", erro);
});

// Traduz erros técnicos do Postgres para mensagens que fazem sentido
// pra quem usa o app. 42P01 = tabela não existe (schema.sql não rodado).
export function traduzirErroBanco(erro: unknown): string {
  const codigo = erro && typeof erro === "object" && "code" in erro
    ? (erro as { code: string }).code
    : undefined;

  return codigo === "42P01"
    ? "O banco de dados ainda não foi criado. Aplique o schema.sql."
    : "Ocorreu um erro ao acessar o banco de dados.";
}