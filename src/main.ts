import { app, BrowserWindow, ipcMain, Menu } from "electron";
import path from "path";
import os from "os";
import fs from "fs";
import dns from "dns";
import Tesseract from "tesseract.js";
import { pool, traduzirErroBanco } from "./db";

// Corrige o AggregateError que aparece às vezes na conexão com o
// Neon: o Node tenta IPv6 antes de IPv4 por padrão, e se a rede local
// não tiver IPv6 configurado a conexão falha sem mensagem clara.
// Precisa vir antes de qualquer conexão ser aberta.
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

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  const urlDoServidorDev = process.env.VITE_DEV_SERVER_URL;

  if (urlDoServidorDev) {
    mainWindow.loadURL(urlDoServidorDev);
    const conteudoDaJanela = mainWindow.webContents;
    conteudoDaJanela.openDevTools();
  } else {
    const caminhoDoIndex = path.join(__dirname, "../dist/index.html");
    mainWindow.loadFile(caminhoDoIndex);
  }
}

function criarMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "Gestor de Fluxo de Caixa",
      submenu: [
        {
          label: "Sobre",
          click: () => {
            console.log("Gestor de Fluxo de Caixa - v1.0.0");
          },
        },
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
    {
      label: "Ver",
      submenu: [{ role: "toggleDevTools", label: "Alternar DevTools" }],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  createWindow();
  criarMenu();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  console.log("Até logo! Encerrando o Gestor de Fluxo de Caixa...");
});

ipcMain.handle("canal-ping", async () => {
  return "pong do Processo Main!";
});

// Canal que não depende de banco nenhum - prova o caminho completo entre
// os processos mesmo numa máquina sem o ambiente de banco configurado.
ipcMain.handle("obter-dados-maquina", async () => {
  const memoriaTotalEmBytes = os.totalmem();
  const ramTotalGB = (memoriaTotalEmBytes / 1024 ** 3).toFixed(2);

  const listaProcessadores = os.cpus();
  const primeiroProcessador = listaProcessadores[0];
  const nomeProcessador = primeiroProcessador.model;

  return {
    plataforma: os.platform(),
    processador: nomeProcessador,
    memoriaRam: `${ramTotalGB} GB`,
  };
});

// Também não depende de banco - grava direto em arquivo com fs, prova
// que o Main consegue interagir com o sistema de arquivos local.
ipcMain.handle("registrar-log", async (_event, textoLog: string) => {
  if (!textoLog.trim()) return false;

  const pastaDoApp = app.getAppPath();
  const caminhoArquivo = path.join(pastaDoApp, "logs.txt");
  const timestamp = new Date().toISOString();
  const linhaLog = `[${timestamp}] ${textoLog}\n`;

  try {
    fs.appendFileSync(caminhoArquivo, linhaLog, "utf-8");
    return true;
  } catch (erro: unknown) {
    console.error("Falha de escrita no arquivo:", erro);
    return false;
  }
});

interface FormaPagamento {
  id: number;
  nome: string;
  descricao: string;
}

ipcMain.handle(
  "listar-formas-pagamento",
  async (_event, termo?: string): Promise<FormaPagamento[]> => {
    try {
      if (termo === undefined) {
        const resultado = await pool.query(
          "SELECT id, nome, descricao FROM formas_pagamento ORDER BY nome",
        );
        return resultado.rows;
      }

      const termoNormalizado = termo.trim();

      if (termoNormalizado.length === 0) {
        const resultado = await pool.query(
          "SELECT id, nome, descricao FROM formas_pagamento ORDER BY nome",
        );
        return resultado.rows;
      }

      if (/\d/.test(termoNormalizado)) {
        throw new Error("A busca não pode conter números.");
      }
      if (termoNormalizado.length < 2) {
        throw new Error("Digite ao menos 2 letras para buscar.");
      }

      const resultado = await pool.query(
        "SELECT id, nome, descricao FROM formas_pagamento WHERE nome ILIKE $1 ORDER BY nome",
        [`%${termoNormalizado}%`],
      );
      return resultado.rows;
    } catch (erro: unknown) {
      // Erros de validação (throw new Error acima) já têm mensagem amigável;
      // qualquer outro erro passa pelo tradutor para não vazar detalhe do driver.
      if (erro instanceof Error && !("code" in erro)) {
        throw erro;
      }
      throw new Error(traduzirErroBanco(erro));
    }
  },
);

interface DadosComprovante {
  textoDetectado: string;
  valorDetectado: number | null;
  dataDetectada: string | null;
}

function comTimeout<T>(
  promessa: Promise<T>,
  ms: number,
  mensagemErro: string,
): Promise<T> {
  return Promise.race([
    promessa,
    new Promise<T>((_, rejeitar) =>
      setTimeout(() => rejeitar(new Error(mensagemErro)), ms),
    ),
  ]);
}

ipcMain.handle(
  "ler-comprovante-pix",
  async (_event, imagemBase64: string): Promise<DadosComprovante> => {
    try {
      console.log("[OCR] Iniciando leitura do comprovante...");

      const caminhoWorker =
        require.resolve("tesseract.js/src/worker-script/node/index.js");

      const resultado = await comTimeout(
        Tesseract.recognize(imagemBase64, "por", {
          workerPath: caminhoWorker,
          logger: (info) => {
            console.log("[OCR]", info.status, info.progress);
          },
        }),
        20000,
        "Tempo esgotado ao processar o comprovante. Verifique sua conexão com a internet.",
      );

      console.log("[OCR] Leitura concluída.");
      const textoDetectado = resultado.data.text;

      const padraoValor = /R\$\s*([\d]{1,3}(?:\.\d{3})*,\d{2})/;
      const encontrouValor = textoDetectado.match(padraoValor);

      let valorDetectado: number | null = null;
      if (encontrouValor) {
        const valorTexto = encontrouValor[1]
          .replace(/\./g, "")
          .replace(",", ".");
        valorDetectado = parseFloat(valorTexto);
      }

      const padraoData = /(\d{2})\/(\d{2})\/(\d{4})/;
      const encontrouData = textoDetectado.match(padraoData);

      let dataDetectada: string | null = null;
      if (encontrouData) {
        const [, dia, mes, ano] = encontrouData;
        dataDetectada = `${ano}-${mes}-${dia}`;
      }

      return { textoDetectado, valorDetectado, dataDetectada };
    } catch (erro: unknown) {
      console.error("[OCR] Falha ao processar comprovante:", erro);
      if (erro instanceof Error) {
        throw erro;
      }
      throw new Error("Não foi possível ler o comprovante enviado.");
    }
  },
);

// ===================== CATEGORIAS =====================

ipcMain.handle("listar-categorias", async () => {
  try {
    const resultado = await pool.query(
      "SELECT id, nome, tipo FROM categorias ORDER BY nome",
    );
    return resultado.rows;
  } catch (erro: unknown) {
    throw new Error(traduzirErroBanco(erro));
  }
});

ipcMain.handle(
  "criar-categoria",
  async (_event, nome: string, tipo: "receita" | "despesa") => {
    try {
      if (!nome.trim()) {
        throw new Error("O nome da categoria é obrigatório.");
      }
      if (tipo !== "receita" && tipo !== "despesa") {
        throw new Error("O tipo deve ser 'receita' ou 'despesa'.");
      }

      const resultado = await pool.query(
        "INSERT INTO categorias (nome, tipo) VALUES ($1, $2) RETURNING id, nome, tipo",
        [nome, tipo],
      );
      return resultado.rows[0];
    } catch (erro: unknown) {
      if (erro instanceof Error && !("code" in erro)) {
        throw erro;
      }
      throw new Error(traduzirErroBanco(erro));
    }
  },
);

ipcMain.handle(
  "atualizar-categoria",
  async (_event, id: number, nome: string, tipo: "receita" | "despesa") => {
    try {
      const resultado = await pool.query(
        "UPDATE categorias SET nome = $1, tipo = $2 WHERE id = $3 RETURNING id, nome, tipo",
        [nome, tipo, id],
      );

      if (resultado.rowCount === 0) {
        throw new Error("Categoria não encontrada.");
      }

      return resultado.rows[0];
    } catch (erro: unknown) {
      if (erro instanceof Error && !("code" in erro)) {
        throw erro;
      }
      throw new Error(traduzirErroBanco(erro));
    }
  },
);

ipcMain.handle("deletar-categoria", async (_event, id: number) => {
  try {
    const resultado = await pool.query("DELETE FROM categorias WHERE id = $1", [
      id,
    ]);
    return (resultado.rowCount ?? 0) > 0;
  } catch (erro: unknown) {
    if (
      erro &&
      typeof erro === "object" &&
      "code" in erro &&
      (erro as { code: string }).code === "23503"
    ) {
      throw new Error(
        "Não é possível excluir uma categoria com transações vinculadas.",
      );
    }
    throw new Error(traduzirErroBanco(erro));
  }
});

// ===================== TRANSAÇÕES =====================

interface FiltrosTransacao {
  tipo?: "receita" | "despesa";
  idCategoria?: number;
  dataInicio?: string;
  dataFim?: string;
}

ipcMain.handle(
  "listar-transacoes",
  async (_event, filtros: FiltrosTransacao = {}) => {
    const condicoes: string[] = [];
    const valores: unknown[] = [];

    if (filtros.tipo) {
      valores.push(filtros.tipo);
      condicoes.push(`c.tipo = $${valores.length}`);
    }

    if (filtros.idCategoria) {
      valores.push(filtros.idCategoria);
      condicoes.push(`t.id_categoria = $${valores.length}`);
    }

    if (filtros.dataInicio) {
      valores.push(filtros.dataInicio);
      condicoes.push(`t.data >= $${valores.length}`);
    }

    if (filtros.dataFim) {
      valores.push(filtros.dataFim);
      condicoes.push(`t.data <= $${valores.length}`);
    }

    const clausulaWhere =
      condicoes.length > 0 ? `WHERE ${condicoes.join(" AND ")}` : "";

    // LEFT JOIN em formas_pagamento porque uma transação pode existir
    // sem forma de pagamento definida ainda (id_forma_pagamento é opcional).
    // Se fosse JOIN comum, essas transações sumiriam da lista sem erro.
    const consulta = `
      SELECT
        t.id,
        t.descricao,
        t.valor,
        t.data,
        t.id_categoria,
        c.nome AS categoria_nome,
        c.tipo AS categoria_tipo,
        t.id_forma_pagamento,
        fp.nome AS forma_pagamento_nome
      FROM transacoes t
      JOIN categorias c ON c.id = t.id_categoria
      LEFT JOIN formas_pagamento fp ON fp.id = t.id_forma_pagamento
      ${clausulaWhere}
      ORDER BY t.data DESC, t.id DESC
    `;

    try {
      const resultado = await pool.query(consulta, valores);
      // O driver pg devolve colunas `numeric` como string (evita perda de
      // precisão por padrão). Sem essa conversão, t.valor chega como string
      // no renderer e quebra somas/formatação numérica na tela.
      return resultado.rows.map((linha) => ({
        ...linha,
        valor: Number(linha.valor),
      }));
    } catch (erro: unknown) {
      throw new Error(traduzirErroBanco(erro));
    }
  },
);

ipcMain.handle(
  "criar-transacao",
  async (
    _event,
    descricao: string,
    valor: number,
    data: string,
    idCategoria: number,
    idFormaPagamento: number | null,
  ) => {
    try {
      if (!descricao.trim()) {
        throw new Error("A descrição é obrigatória.");
      }
      if (!valor || valor <= 0) {
        throw new Error("O valor deve ser maior que zero.");
      }
      if (!data) {
        throw new Error("A data é obrigatória.");
      }
      if (!idCategoria) {
        throw new Error("A categoria é obrigatória.");
      }

      const resultado = await pool.query(
        `INSERT INTO transacoes (descricao, valor, data, id_categoria, id_forma_pagamento)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, descricao, valor, data, id_categoria, id_forma_pagamento`,
        [descricao, valor, data, idCategoria, idFormaPagamento],
      );
      return { ...resultado.rows[0], valor: Number(resultado.rows[0].valor) };
    } catch (erro: unknown) {
      if (erro instanceof Error && !("code" in erro)) {
        throw erro;
      }
      throw new Error(traduzirErroBanco(erro));
    }
  },
);

ipcMain.handle(
  "atualizar-transacao",
  async (
    _event,
    id: number,
    descricao: string,
    valor: number,
    data: string,
    idCategoria: number,
    idFormaPagamento: number | null,
  ) => {
    try {
      const resultado = await pool.query(
        `UPDATE transacoes
         SET descricao = $1, valor = $2, data = $3, id_categoria = $4, id_forma_pagamento = $5
         WHERE id = $6
         RETURNING id, descricao, valor, data, id_categoria, id_forma_pagamento`,
        [descricao, valor, data, idCategoria, idFormaPagamento, id],
      );

      if (resultado.rowCount === 0) {
        throw new Error("Transação não encontrada.");
      }

      return { ...resultado.rows[0], valor: Number(resultado.rows[0].valor) };
    } catch (erro: unknown) {
      if (erro instanceof Error && !("code" in erro)) {
        throw erro;
      }
      throw new Error(traduzirErroBanco(erro));
    }
  },
);

ipcMain.handle("deletar-transacao", async (_event, id: number) => {
  try {
    const resultado = await pool.query("DELETE FROM transacoes WHERE id = $1", [
      id,
    ]);
    return (resultado.rowCount ?? 0) > 0;
  } catch (erro: unknown) {
    throw new Error(traduzirErroBanco(erro));
  }
});

// ===================== SALDO CONSOLIDADO =====================

ipcMain.handle("obter-saldo", async () => {
  try {
    const resultado = await pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN c.tipo = 'receita' THEN t.valor ELSE 0 END), 0) AS total_receitas,
        COALESCE(SUM(CASE WHEN c.tipo = 'despesa' THEN t.valor ELSE 0 END), 0) AS total_despesas
      FROM transacoes t
      JOIN categorias c ON c.id = t.id_categoria
    `);

    const { total_receitas, total_despesas } = resultado.rows[0];
    const totalReceitas = Number(total_receitas);
    const totalDespesas = Number(total_despesas);
    const saldo = totalReceitas - totalDespesas;

    return {
      totalReceitas,
      totalDespesas,
      saldo,
    };
  } catch (erro: unknown) {
    throw new Error(traduzirErroBanco(erro));
  }
});
