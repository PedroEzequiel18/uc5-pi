import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  ping: () => ipcRenderer.invoke('canal-ping'),
  obterDadosMaquina: () => ipcRenderer.invoke('obter-dados-maquina'),
  calcularImc: (peso: number, altura: number) => ipcRenderer.invoke('calcular-imc', peso, altura),
  escreverLog: (mensagem: string) => ipcRenderer.invoke('registrar-log', mensagem),
})