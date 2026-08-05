import { app, BrowserWindow, ipcMain, Menu } from "electron";
import path from "path";
import os from "os";
import fs from "fs";
import { pool } from "./db";

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
        {
          label: "Sair",
          role: "quit",
        },
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

ipcMain.handle("calcular-imc", async (_event, peso: number, altura: number) => {
  if (!peso || !altura || peso <= 0 || altura <= 0) {
    throw new Error("Valores de peso ou altura inválidos.");
  }

  const alturaAoQuadrado = altura * altura;
  const imcCalculado = peso / alturaAoQuadrado;
  const imcFormatado = imcCalculado.toFixed(2);
  const imc = parseFloat(imcFormatado);

  let classificacao = "";

  if (imc < 18.5) classificacao = "Abaixo do peso";
  else if (imc < 25.0) classificacao = "Peso normal";
  else if (imc < 29.9) classificacao = "Sobrepeso";
  else classificacao = "Obesidade";

  return { imc, classificacao };
});

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

// ===================== CATEGORIAS =====================

ipcMain.handle("listar-categorias", async () => {
  const resultado = await pool.query(
    "SELECT id, nome, tipo FROM categorias ORDER BY nome"
  );
  return resultado.rows;
});

ipcMain.handle(
  "criar-categoria",
  async (_event, nome: string, tipo: "receita" | "despesa") => {
    if (!nome.trim()) {
      throw new Error("O nome da categoria é obrigatório.");
    }
    if (tipo !== "receita" && tipo !== "despesa") {
      throw new Error("O tipo deve ser 'receita' ou 'despesa'.");
    }

    const resultado = await pool.query(
      "INSERT INTO categorias (nome, tipo) VALUES ($1, $2) RETURNING id, nome, tipo",
      [nome, tipo]
    );
    return resultado.rows[0];
  }
);

ipcMain.handle(
  "atualizar-categoria",
  async (_event, id: number, nome: string, tipo: "receita" | "despesa") => {
    const resultado = await pool.query(
      "UPDATE categorias SET nome = $1, tipo = $2 WHERE id = $3 RETURNING id, nome, tipo",
      [nome, tipo, id]
    );

    if (resultado.rowCount === 0) {
      throw new Error("Categoria não encontrada.");
    }

    return resultado.rows[0];
  }
);

ipcMain.handle("deletar-categoria", async (_event, id: number) => {
  const resultado = await pool.query("DELETE FROM categorias WHERE id = $1", [
    id,
  ]);
  return (resultado.rowCount ?? 0) > 0;
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

    const consulta = `
      SELECT
        t.id,
        t.descricao,
        t.valor,
        t.data,
        t.id_categoria,
        c.nome AS categoria_nome,
        c.tipo AS categoria_tipo
      FROM transacoes t
      JOIN categorias c ON c.id = t.id_categoria
      ${clausulaWhere}
      ORDER BY t.data DESC, t.id DESC
    `;

    const resultado = await pool.query(consulta, valores);
    return resultado.rows;
  }
);

ipcMain.handle(
  "criar-transacao",
  async (
    _event,
    descricao: string,
    valor: number,
    data: string,
    idCategoria: number
  ) => {
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
      `INSERT INTO transacoes (descricao, valor, data, id_categoria)
       VALUES ($1, $2, $3, $4)
       RETURNING id, descricao, valor, data, id_categoria`,
      [descricao, valor, data, idCategoria]
    );
    return resultado.rows[0];
  }
);

ipcMain.handle(
  "atualizar-transacao",
  async (
    _event,
    id: number,
    descricao: string,
    valor: number,
    data: string,
    idCategoria: number
  ) => {
    const resultado = await pool.query(
      `UPDATE transacoes
       SET descricao = $1, valor = $2, data = $3, id_categoria = $4
       WHERE id = $5
       RETURNING id, descricao, valor, data, id_categoria`,
      [descricao, valor, data, idCategoria, id]
    );

    if (resultado.rowCount === 0) {
      throw new Error("Transação não encontrada.");
    }

    return resultado.rows[0];
  }
);

ipcMain.handle("deletar-transacao", async (_event, id: number) => {
  const resultado = await pool.query("DELETE FROM transacoes WHERE id = $1", [
    id,
  ]);
  return (resultado.rowCount ?? 0) > 0;
});

// ===================== SALDO =====================

ipcMain.handle("obter-saldo", async () => {
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
});