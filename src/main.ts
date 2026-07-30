import { app, BrowserWindow, ipcMain, Menu } from "electron";
import path from "path";
import os from "os";
import fs from "fs";

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

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
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
  const ramTotalGB = (os.totalmem() / 1024 ** 3).toFixed(2);
  return {
    plataforma: os.platform(),
    processador: os.cpus()[0].model,
    memoriaRam: `${ramTotalGB} GB`,
  };
});

ipcMain.handle("calcular-imc", async (_event, peso: number, altura: number) => {
  if (!peso || !altura || peso <= 0 || altura <= 0) {
    throw new Error("Valores de peso ou altura inválidos.");
  }

  const imc = parseFloat((peso / (altura * altura)).toFixed(2));
  let classificacao = "";

  if (imc < 18.5) classificacao = "Abaixo do peso";
  else if (imc < 25.0) classificacao = "Peso normal";
  else if (imc < 29.9) classificacao = "Sobrepeso";
  else classificacao = "Obesidade";

  return { imc, classificacao };
});

ipcMain.handle("registrar-log", async (_event, textoLog: string) => {
  if (!textoLog.trim()) return false;

  const caminhoArquivo = path.join(app.getAppPath(), "logs.txt");
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