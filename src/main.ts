import { app, BrowserWindow, ipcMain, Menu } from "electron";
import path from "path";
import os from "os";
import fs from "fs";
import dns from "dns";
import Tesseract from "tesseract.js";
import { pool, traduzirErroBanco } from "./db";

// Corrige erro de conexão com o Neon forçando IPv4 antes do IPv6.
dns.setDefaultResultOrder("ipv4first");

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    minWidth: 800,
    minHeight: 600,
    center: true,
    title: "Gestor de Fluxo de Caixa",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());

  const urlDoServidorDev = process.env.VITE_DEV_SERVER_URL;
  if (urlDoServidorDev) {
    mainWindow.loadURL(urlDoServidorDev);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

function criarMenu() {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "Gestor de Fluxo de Caixa",
        submenu: [
          { label: "Sobre", click: () => console.log("Gestor de Fluxo de Caixa - v1.0.0") },
          { type: "separator" },
          { label: "Sair", role: "quit" },
        ],
      },
      {
        label: "Editar",
        submenu: [
          { role: "undo", label: "Desfazer" },
          { role: "redo", label: "Refazer" },
          { type: "separator" },
          { role: "cut", label: "Recortar" },
          { role: "copy", label: "Copiar" },
          { role: "paste", label: "Colar" },
        ],
      },
      { label: "Ver", submenu: [{ role: "toggleDevTools", label: "Alternar DevTools" }] },
    ]),
  );
}

app.whenReady().then(() => {
  createWindow();
  criarMenu();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => console.log("Até logo! Encerrando o Gestor de Fluxo de Caixa..."));

// ===================== HELPERS =====================

// Códigos de erro do Postgres que merecem uma mensagem específica pro usuário.
const MENSAGENS_DE_ERRO: Record<string, string> = {
  "23503": "Não é possível excluir uma categoria com transações vinculadas.",
};

// Centraliza o try/catch de todos os handlers: erros de validação (sem "code")
// sobem como estão; erros do Postgres viram mensagem amigável.
async function comTraducaoDeErro<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (erro: unknown) {
    if (erro instanceof Error && !("code" in erro)) throw erro;
    const codigo = (erro as { code?: string })?.code;
    throw new Error(codigo && MENSAGENS_DE_ERRO[codigo] ? MENSAGENS_DE_ERRO[codigo] : traduzirErroBanco(erro));
  }
}

const comValorNumerico = (linha: any) => ({ ...linha, valor: Number(linha.valor) });

function comTimeout<T>(promessa: Promise<T>, ms: number, mensagemErro: string): Promise<T> {
  return Promise.race([
    promessa,
    new Promise<T>((_, rejeitar) => setTimeout(() => rejeitar(new Error(mensagemErro)), ms)),
  ]);
}

// ===================== DIAGNÓSTICO / OCR =====================

ipcMain.handle("canal-ping", async () => "pong do Processo Main!");

ipcMain.handle("obter-dados-maquina", async () => {
  const ramTotalGB = (os.totalmem() / 1024 ** 3).toFixed(2);
  return {
    plataforma: os.platform(),
    processador: os.cpus()[0].model,
    memoriaRam: `${ramTotalGB} GB`,
  };
});

ipcMain.handle("registrar-log", async (_event, textoLog: string) => {
  if (!textoLog.trim()) return false;

  const caminhoArquivo = path.join(app.getAppPath(), "logs.txt");
  try {
    fs.appendFileSync(caminhoArquivo, `[${new Date().toISOString()}] ${textoLog}\n`, "utf-8");
    return true;
  } catch (erro: unknown) {
    console.error("Falha de escrita no arquivo:", erro);
    return false;
  }
});

interface DadosComprovante {
  textoDetectado: string;
  valorDetectado: number | null;
  dataDetectada: string | null;
}

ipcMain.handle(
  "ler-comprovante-pix",
  async (_event, imagemBase64: string): Promise<DadosComprovante> => {
    try {
      const caminhoWorker = require.resolve("tesseract.js/src/worker-script/node/index.js");

      const resultado = await comTimeout(
        Tesseract.recognize(imagemBase64, "por", {
          workerPath: caminhoWorker,
          logger: (info) => console.log("[OCR]", info.status, info.progress),
        }),
        20000,
        "Tempo esgotado ao processar o comprovante. Verifique sua conexão com a internet.",
      );

      const textoDetectado = resultado.data.text;

      const encontrouValor = textoDetectado.match(/R\$\s*([\d]{1,3}(?:\.\d{3})*,\d{2})/);
      const valorDetectado = encontrouValor
        ? parseFloat(encontrouValor[1].replace(/\./g, "").replace(",", "."))
        : null;

      const encontrouData = textoDetectado.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      const dataDetectada = encontrouData
        ? `${encontrouData[3]}-${encontrouData[2]}-${encontrouData[1]}`
        : null;

      return { textoDetectado, valorDetectado, dataDetectada };
    } catch (erro: unknown) {
      console.error("[OCR] Falha ao processar comprovante:", erro);
      throw erro instanceof Error ? erro : new Error("Não foi possível ler o comprovante enviado.");
    }
  },
);

// ===================== FORMAS DE PAGAMENTO =====================

interface FormaPagamento {
  id: number;
  nome: string;
  descricao: string;
}

ipcMain.handle("listar-formas-pagamento", (_event, termo?: string): Promise<FormaPagamento[]> =>
  comTraducaoDeErro(async () => {
    const termoNormalizado = termo?.trim();

    if (!termoNormalizado) {
      const resultado = await pool.query(
        "SELECT id, nome, descricao FROM formas_pagamento ORDER BY nome",
      );
      return resultado.rows;
    }

    if (/\d/.test(termoNormalizado)) throw new Error("A busca não pode conter números.");
    if (termoNormalizado.length < 2) throw new Error("Digite ao menos 2 letras para buscar.");

    const resultado = await pool.query(
      "SELECT id, nome, descricao FROM formas_pagamento WHERE nome ILIKE $1 ORDER BY nome",
      [`%${termoNormalizado}%`],
    );
    return resultado.rows;
  }),
);

// ===================== CATEGORIAS =====================

ipcMain.handle("listar-categorias", () =>
  comTraducaoDeErro(async () => {
    const resultado = await pool.query("SELECT id, nome, tipo FROM categorias ORDER BY nome");
    return resultado.rows;
  }),
);

ipcMain.handle(
  "criar-categoria",
  (_event, nome: string, tipo: "receita" | "despesa") =>
    comTraducaoDeErro(async () => {
      if (!nome.trim()) throw new Error("O nome da categoria é obrigatório.");
      if (tipo !== "receita" && tipo !== "despesa")
        throw new Error("O tipo deve ser 'receita' ou 'despesa'.");

      const resultado = await pool.query(
        "INSERT INTO categorias (nome, tipo) VALUES ($1, $2) RETURNING id, nome, tipo",
        [nome, tipo],
      );
      return resultado.rows[0];
    }),
);

ipcMain.handle(
  "atualizar-categoria",
  (_event, id: number, nome: string, tipo: "receita" | "despesa") =>
    comTraducaoDeErro(async () => {
      const resultado = await pool.query(
        "UPDATE categorias SET nome = $1, tipo = $2 WHERE id = $3 RETURNING id, nome, tipo",
        [nome, tipo, id],
      );
      if (resultado.rowCount === 0) throw new Error("Categoria não encontrada.");
      return resultado.rows[0];
    }),
);

ipcMain.handle("deletar-categoria", (_event, id: number) =>
  comTraducaoDeErro(async () => {
    const resultado = await pool.query("DELETE FROM categorias WHERE id = $1", [id]);
    return (resultado.rowCount ?? 0) > 0;
  }),
);

// ===================== TRANSAÇÕES =====================

interface FiltrosTransacao {
  tipo?: "receita" | "despesa";
  idCategoria?: number;
  dataInicio?: string;
  dataFim?: string;
}

ipcMain.handle("listar-transacoes", (_event, filtros: FiltrosTransacao = {}) =>
  comTraducaoDeErro(async () => {
    const condicoes: string[] = [];
    const valores: unknown[] = [];

    const adicionarCondicao = (coluna: string, valor: unknown) => {
      if (valor === undefined || valor === null || valor === "") return;
      valores.push(valor);
      condicoes.push(`${coluna} = $${valores.length}`);
    };

    adicionarCondicao("c.tipo", filtros.tipo);
    adicionarCondicao("t.id_categoria", filtros.idCategoria);
    if (filtros.dataInicio) {
      valores.push(filtros.dataInicio);
      condicoes.push(`t.data >= $${valores.length}`);
    }
    if (filtros.dataFim) {
      valores.push(filtros.dataFim);
      condicoes.push(`t.data <= $${valores.length}`);
    }

    const clausulaWhere = condicoes.length > 0 ? `WHERE ${condicoes.join(" AND ")}` : "";

    // LEFT JOIN porque forma de pagamento é opcional na transação.
    const resultado = await pool.query(
      `SELECT
         t.id, t.descricao, t.valor, t.data, t.id_categoria,
         c.nome AS categoria_nome, c.tipo AS categoria_tipo,
         t.id_forma_pagamento, fp.nome AS forma_pagamento_nome
       FROM transacoes t
       JOIN categorias c ON c.id = t.id_categoria
       LEFT JOIN formas_pagamento fp ON fp.id = t.id_forma_pagamento
       ${clausulaWhere}
       ORDER BY t.data DESC, t.id DESC`,
      valores,
    );
    // Postgres devolve numeric como texto - convertendo aqui, uma vez só.
    return resultado.rows.map(comValorNumerico);
  }),
);

function validarTransacao(descricao: string, valor: number, data: string, idCategoria: number) {
  if (!descricao.trim()) throw new Error("A descrição é obrigatória.");
  if (!valor || valor <= 0) throw new Error("O valor deve ser maior que zero.");
  if (!data) throw new Error("A data é obrigatória.");
  if (!idCategoria) throw new Error("A categoria é obrigatória.");
}

ipcMain.handle(
  "criar-transacao",
  (
    _event,
    descricao: string,
    valor: number,
    data: string,
    idCategoria: number,
    idFormaPagamento: number | null,
  ) =>
    comTraducaoDeErro(async () => {
      validarTransacao(descricao, valor, data, idCategoria);

      const resultado = await pool.query(
        `INSERT INTO transacoes (descricao, valor, data, id_categoria, id_forma_pagamento)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, descricao, valor, data, id_categoria, id_forma_pagamento`,
        [descricao, valor, data, idCategoria, idFormaPagamento],
      );
      return comValorNumerico(resultado.rows[0]);
    }),
);

ipcMain.handle(
  "atualizar-transacao",
  (
    _event,
    id: number,
    descricao: string,
    valor: number,
    data: string,
    idCategoria: number,
    idFormaPagamento: number | null,
  ) =>
    comTraducaoDeErro(async () => {
      const resultado = await pool.query(
        `UPDATE transacoes
         SET descricao = $1, valor = $2, data = $3, id_categoria = $4, id_forma_pagamento = $5
         WHERE id = $6
         RETURNING id, descricao, valor, data, id_categoria, id_forma_pagamento`,
        [descricao, valor, data, idCategoria, idFormaPagamento, id],
      );
      if (resultado.rowCount === 0) throw new Error("Transação não encontrada.");
      return comValorNumerico(resultado.rows[0]);
    }),
);

ipcMain.handle("deletar-transacao", (_event, id: number) =>
  comTraducaoDeErro(async () => {
    const resultado = await pool.query("DELETE FROM transacoes WHERE id = $1", [id]);
    return (resultado.rowCount ?? 0) > 0;
  }),
);

// ===================== SALDO CONSOLIDADO =====================

ipcMain.handle("obter-saldo", () =>
  comTraducaoDeErro(async () => {
    const resultado = await pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN c.tipo = 'receita' THEN t.valor ELSE 0 END), 0) AS total_receitas,
        COALESCE(SUM(CASE WHEN c.tipo = 'despesa' THEN t.valor ELSE 0 END), 0) AS total_despesas
      FROM transacoes t
      JOIN categorias c ON c.id = t.id_categoria
    `);

    const totalReceitas = Number(resultado.rows[0].total_receitas);
    const totalDespesas = Number(resultado.rows[0].total_despesas);

    return { totalReceitas, totalDespesas, saldo: totalReceitas - totalDespesas };
  }),
);