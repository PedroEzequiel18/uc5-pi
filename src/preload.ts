import { contextBridge, ipcRenderer } from 'electron'

// Expõe só o necessário pro renderer, mantendo contextIsolation seguro.
contextBridge.exposeInMainWorld('api', {
  ping: () => ipcRenderer.invoke('canal-ping'),
  obterDadosMaquina: () => ipcRenderer.invoke('obter-dados-maquina'),
  escreverLog: (mensagem: string) => ipcRenderer.invoke('registrar-log', mensagem),
  listarFormasPagamento: (termo?: string) => ipcRenderer.invoke('listar-formas-pagamento', termo),

  // Categorias
  listarCategorias: () => ipcRenderer.invoke('listar-categorias'),
  criarCategoria: (nome: string, tipo: 'receita' | 'despesa') =>
    ipcRenderer.invoke('criar-categoria', nome, tipo),
  atualizarCategoria: (id: number, nome: string, tipo: 'receita' | 'despesa') =>
    ipcRenderer.invoke('atualizar-categoria', id, nome, tipo),
  deletarCategoria: (id: number) => ipcRenderer.invoke('deletar-categoria', id),

  // Transações
  listarTransacoes: (filtros?: {
    tipo?: 'receita' | 'despesa'
    idCategoria?: number
    dataInicio?: string
    dataFim?: string
  }) => ipcRenderer.invoke('listar-transacoes', filtros ?? {}),
  criarTransacao: (
    descricao: string,
    valor: number,
    data: string,
    idCategoria: number
  ) => ipcRenderer.invoke('criar-transacao', descricao, valor, data, idCategoria),
  atualizarTransacao: (
    id: number,
    descricao: string,
    valor: number,
    data: string,
    idCategoria: number
  ) =>
    ipcRenderer.invoke(
      'atualizar-transacao',
      id,
      descricao,
      valor,
      data,
      idCategoria
    ),
  deletarTransacao: (id: number) => ipcRenderer.invoke('deletar-transacao', id),

  // Saldo
  obterSaldo: () => ipcRenderer.invoke('obter-saldo'),
})