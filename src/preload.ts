import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  ping: () => ipcRenderer.invoke("canal-ping"),
  obterDadosMaquina: () => ipcRenderer.invoke("obter-dados-maquina"),
  escreverLog: (mensagem: string) => ipcRenderer.invoke("registrar-log", mensagem),
  listarFormasPagamento: (termo?: string) => ipcRenderer.invoke("listar-formas-pagamento", termo),
  lerComprovantePix: (imagemBase64: string) => ipcRenderer.invoke("ler-comprovante-pix", imagemBase64),

  listarCategorias: () => ipcRenderer.invoke("listar-categorias"),
  criarCategoria: (nome: string, tipo: "receita" | "despesa") =>
    ipcRenderer.invoke("criar-categoria", nome, tipo),
  atualizarCategoria: (id: number, nome: string, tipo: "receita" | "despesa") =>
    ipcRenderer.invoke("atualizar-categoria", id, nome, tipo),
  deletarCategoria: (id: number) => ipcRenderer.invoke("deletar-categoria", id),

  listarTransacoes: (filtros?: {
    tipo?: "receita" | "despesa";
    idCategoria?: number;
    dataInicio?: string;
    dataFim?: string;
  }) => ipcRenderer.invoke("listar-transacoes", filtros ?? {}),
  criarTransacao: (
    descricao: string,
    valor: number,
    data: string,
    idCategoria: number,
    idFormaPagamento: number | null,
  ) => ipcRenderer.invoke("criar-transacao", descricao, valor, data, idCategoria, idFormaPagamento),
  atualizarTransacao: (
    id: number,
    descricao: string,
    valor: number,
    data: string,
    idCategoria: number,
    idFormaPagamento: number | null,
  ) =>
    ipcRenderer.invoke(
      "atualizar-transacao",
      id,
      descricao,
      valor,
      data,
      idCategoria,
      idFormaPagamento,
    ),
  deletarTransacao: (id: number) => ipcRenderer.invoke("deletar-transacao", id),

  obterSaldo: () => ipcRenderer.invoke("obter-saldo"),
});