import './style.css'

declare global {
  interface Window {
    api: {
      ping: () => Promise<string>;
      obterDadosMaquina: () => Promise<{ plataforma: string; processador: string; memoriaRam: string }>;
      calcularImc: (peso: number, altura: number) => Promise<{ imc: number; classificacao: string }>;
      escreverLog: (mensagem: string) => Promise<boolean>;
    };
  }
}

const btnPing = document.getElementById('btn-ping') as HTMLButtonElement
const resposta = document.getElementById('resposta') as HTMLParagraphElement

btnPing.addEventListener('click', async () => {
  resposta.textContent = 'Enviando ping...'
  try {
    const retorno = await window.api.ping()
    resposta.textContent = `Resposta: ${retorno}`
  } catch (erro) {
    resposta.textContent = 'Erro ao comunicar com o Processo Main.'
    console.error(erro)
  }
})

const btnHardware = document.getElementById('btn-hardware') as HTMLButtonElement
const resHardware = document.getElementById('res-hardware') as HTMLParagraphElement

btnHardware.addEventListener('click', async () => {
  resHardware.textContent = 'Coletando dados do sistema...'
  try {
    const dados = await window.api.obterDadosMaquina()
    resHardware.innerHTML = `
      <strong>Plataforma:</strong> ${dados.plataforma}<br>
      <strong>Processador:</strong> ${dados.processador}<br>
      <strong>Memória RAM:</strong> ${dados.memoriaRam}
    `
  } catch (erro) {
    resHardware.textContent = 'Erro ao consultar dados de hardware.'
    console.error(erro)
  }
})

const inputPeso = document.getElementById('peso') as HTMLInputElement
const inputAltura = document.getElementById('altura') as HTMLInputElement
const btnImc = document.getElementById('btn-imc') as HTMLButtonElement
const resImc = document.getElementById('res-imc') as HTMLParagraphElement

btnImc.addEventListener('click', async () => {
  const peso = parseFloat(inputPeso.value)
  const altura = parseFloat(inputAltura.value)

  try {
    const resultado = await window.api.calcularImc(peso, altura)
    resImc.innerHTML = `Seu IMC é <strong>${resultado.imc}</strong> (${resultado.classificacao})`
  } catch (erro: unknown) {
    resImc.textContent = 'Erro: Verifique os dados inseridos.'
  }
})

const campoLog = document.getElementById('campo-log') as HTMLInputElement
const btnLog = document.getElementById('btn-log') as HTMLButtonElement
const resLog = document.getElementById('res-log') as HTMLParagraphElement

btnLog.addEventListener('click', async () => {
  const mensagem = campoLog.value
  const sucesso = await window.api.escreverLog(mensagem)
  if (sucesso) {
    resLog.textContent = 'Mensagem salva com sucesso em logs.txt!'
    campoLog.value = ''
  } else {
    resLog.textContent = 'Escreva algo no campo para salvar.'
  }
})

export {}