import { Pool } from "pg";
import dotenv from "dotenv";
import path from "path";
import { app } from "electron";

// app.isPackaged: false no "npm run dev", true no aplicativo instalado.
// Rodando via npm, o .env está na raiz do projeto (comportamento padrão
// do dotenv). Empacotado, o .env some do diretório de trabalho -
// process.resourcesPath/.env é onde o electron-builder o copiou
// (chave "extraResources" no package.json).
// Isso precisa vir ANTES de qualquer leitura de process.env.DATABASE_URL.
dotenv.config(
  app.isPackaged
    ? { path: path.join(process.resourcesPath, ".env") }
    : undefined,
);

// Connection string vem do .env - nunca escrita direto no código.
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL não encontrada. Confira se o arquivo .env existe e está configurado.",
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

// Traduz códigos de erro comuns do Postgres para mensagens que fazem
// sentido pra quem está usando o app (não pra quem está debugando).
// 42P01 = "relation does not exist": acontece quando o banco existe
// mas o schema.sql ainda não foi aplicado nele.
export function traduzirErroBanco(erro: unknown): string {
  if (erro && typeof erro === "object" && "code" in erro) {
    const codigo = (erro as { code: string }).code;
    if (codigo === "42P01") {
      return "O banco de dados ainda não foi criado. Aplique o schema.sql.";
    }
  }
  return "Ocorreu um erro ao acessar o banco de dados.";
}
