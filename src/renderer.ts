export {}

// Avisa o TypeScript que window.api existe (criado pelo preload).
declare global {
  interface Window {
    api: {
      ping: () => Promise<string>
      obterDadosMaquina: () => Promise<{
        plataforma: string
        processador: string
        memoriaRam: string
      }>
      escreverLog: (mensagem: string) => Promise<boolean>
      listarFormasPagamento: (termo?: string) => Promise<FormaPagamento[]>

      listarCategorias: () => Promise<Categoria[]>
      criarCategoria: (
        nome: string,
        tipo: 'receita' | 'despesa'
      ) => Promise<Categoria>
      atualizarCategoria: (
        id: number,
        nome: string,
        tipo: 'receita' | 'despesa'
      ) => Promise<Categoria>
      deletarCategoria: (id: number) => Promise<boolean>

      listarTransacoes: (filtros?: {
        tipo?: 'receita' | 'despesa'
        idCategoria?: number
        dataInicio?: string
        dataFim?: string
      }) => Promise<Transacao[]>
      criarTransacao: (
        descricao: string,
        valor: number,
        data: string,
        idCategoria: number
      ) => Promise<Transacao>
      atualizarTransacao: (
        id: number,
        descricao: string,
        valor: number,
        data: string,
        idCategoria: number
      ) => Promise<Transacao>
      deletarTransacao: (id: number) => Promise<boolean>

      obterSaldo: () => Promise<{
        totalReceitas: number
        totalDespesas: number
        saldo: number
      }>
    }
  }
}

interface Categoria {
  id: number
  nome: string
  tipo: 'receita' | 'despesa'
}

interface FormaPagamento {
  id: number
  nome: string
  descricao: string
}

interface Transacao {
  id: number
  descricao: string
  valor: string // pg devolve NUMERIC como string
  data: string
  id_categoria: number
  categoria_nome: string
  categoria_tipo: 'receita' | 'despesa'
}

function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

// ===================== PING (boilerplate) =====================

const botaoPing = document.getElementById('btn-ping')
const respostaPing = document.getElementById('resposta')

botaoPing?.addEventListener('click', async () => {
  const resposta = await window.api.ping()
  if (respostaPing) respostaPing.textContent = resposta
})

// ===================== FORMAS DE PAGAMENTO =====================

const listaFormasPagamentoEl = document.getElementById('lista-formas-pagamento')
const formBuscaPagamentoEl = document.getElementById(
  'form-busca-pagamento'
) as HTMLFormElement | null
const inputBuscaPagamentoEl = document.getElementById(
  'busca-formas-pagamento'
) as HTMLInputElement | null
const erroBuscaPagamentoEl = document.getElementById('erro-busca-pagamento')
const statusBuscaPagamentoEl = document.getElementById('status-busca-pagamento')

// Chama o Main (mesmo canal listar-formas-pagamento) e trata os 3 desfechos:
// recusa (erro), vazio (nenhum resultado) ou lista encontrada.
async function carregarFormasPagamento(termo?: string) {
  if (!listaFormasPagamentoEl) return

  try {
    const formasPagamento = await window.api.listarFormasPagamento(termo)

    if (erroBuscaPagamentoEl) erroBuscaPagamentoEl.textContent = ''
    listaFormasPagamentoEl.innerHTML = ''

    if (formasPagamento.length === 0) {
      if (statusBuscaPagamentoEl)
        statusBuscaPagamentoEl.textContent = 'Nenhuma forma de pagamento encontrada.'
      return
    }

    if (statusBuscaPagamentoEl) statusBuscaPagamentoEl.textContent = ''

    formasPagamento.forEach((forma) => {
      const item = document.createElement('li')
      item.textContent = `${forma.nome} - ${forma.descricao}`
      listaFormasPagamentoEl.appendChild(item)
    })
  } catch (erro: unknown) {
    // Desfecho de recusa: o Main lançou Error porque o termo era inválido.
    listaFormasPagamentoEl.innerHTML = ''
    if (statusBuscaPagamentoEl) statusBuscaPagamentoEl.textContent = ''
    if (erroBuscaPagamentoEl && erro instanceof Error) {
      erroBuscaPagamentoEl.textContent = erro.message
    }
  }
}

// Busca de verdade: só aqui o IPC é chamado de novo.
formBuscaPagamentoEl?.addEventListener('submit', async (evento) => {
  evento.preventDefault()
  const termo = inputBuscaPagamentoEl?.value ?? ''
  await carregarFormasPagamento(termo)
})

// Filtro no cliente: reage a cada tecla digitada, mas só esconde os itens
// que já estão na tela - nenhuma chamada nova ao IPC acontece aqui.
inputBuscaPagamentoEl?.addEventListener('input', () => {
  if (!listaFormasPagamentoEl) return

  const termoDigitado = inputBuscaPagamentoEl.value.trim().toLowerCase()
  const itens = listaFormasPagamentoEl.querySelectorAll('li')

  itens.forEach((item) => {
    const texto = item.textContent?.toLowerCase() ?? ''
    const corresponde = texto.includes(termoDigitado)
    item.style.display = corresponde ? '' : 'none'
  })
})

// ===================== SALDO =====================

const botaoAtualizarSaldo = document.getElementById('btn-atualizar-saldo')
const saldoReceitasEl = document.getElementById('saldo-receitas')
const saldoDespesasEl = document.getElementById('saldo-despesas')
const saldoTotalEl = document.getElementById('saldo-total')

async function atualizarSaldo() {
  const { totalReceitas, totalDespesas, saldo } = await window.api.obterSaldo()

  if (saldoReceitasEl)
    saldoReceitasEl.textContent = `Receitas: ${formatarMoeda(totalReceitas)}`
  if (saldoDespesasEl)
    saldoDespesasEl.textContent = `Despesas: ${formatarMoeda(totalDespesas)}`
  if (saldoTotalEl)
    saldoTotalEl.innerHTML = `<strong>Saldo: ${formatarMoeda(saldo)}</strong>`
}

botaoAtualizarSaldo?.addEventListener('click', atualizarSaldo)

// ===================== CATEGORIAS =====================

const formCategoria = document.getElementById(
  'form-categoria'
) as HTMLFormElement | null
const categoriaIdInput = document.getElementById(
  'categoria-id'
) as HTMLInputElement | null
const categoriaNomeInput = document.getElementById(
  'categoria-nome'
) as HTMLInputElement | null
const categoriaTipoSelect = document.getElementById(
  'categoria-tipo'
) as HTMLSelectElement | null
const listaCategoriasEl = document.getElementById('lista-categorias')
const msgCategoriaEl = document.getElementById('msg-categoria')
const botaoCancelarCategoria = document.getElementById(
  'btn-cancelar-categoria'
)

const selectTransacaoCategoria = document.getElementById(
  'transacao-categoria'
) as HTMLSelectElement | null
const selectFiltroCategoria = document.getElementById(
  'filtro-categoria'
) as HTMLSelectElement | null

function limparFormularioCategoria() {
  if (categoriaIdInput) categoriaIdInput.value = ''
  if (categoriaNomeInput) categoriaNomeInput.value = ''
  if (categoriaTipoSelect) categoriaTipoSelect.value = ''
}

async function carregarCategorias() {
  const categorias = await window.api.listarCategorias()

  if (listaCategoriasEl) {
    listaCategoriasEl.innerHTML = ''

    categorias.forEach((categoria) => {
      const item = document.createElement('li')
      item.textContent = `${categoria.nome} (${categoria.tipo}) `

      const botaoEditar = document.createElement('button')
      botaoEditar.textContent = 'Editar'
      botaoEditar.addEventListener('click', () => {
        if (categoriaIdInput) categoriaIdInput.value = String(categoria.id)
        if (categoriaNomeInput) categoriaNomeInput.value = categoria.nome
        if (categoriaTipoSelect) categoriaTipoSelect.value = categoria.tipo
      })

      const botaoExcluir = document.createElement('button')
      botaoExcluir.textContent = 'Excluir'
      botaoExcluir.addEventListener('click', async () => {
        await window.api.deletarCategoria(categoria.id)
        await carregarCategorias()
        await carregarTransacoes()
      })

      item.appendChild(botaoEditar)
      item.appendChild(botaoExcluir)
      listaCategoriasEl.appendChild(item)
    })
  }

  ;[selectTransacaoCategoria, selectFiltroCategoria].forEach((select) => {
    if (!select) return

    const valorAtual = select.value
    const primeiraOpcao = select.options[0]
    select.innerHTML = ''
    select.appendChild(primeiraOpcao)

    categorias.forEach((categoria) => {
      const opcao = document.createElement('option')
      opcao.value = String(categoria.id)
      opcao.textContent = `${categoria.nome} (${categoria.tipo})`
      select.appendChild(opcao)
    })

    select.value = valorAtual
  })
}

formCategoria?.addEventListener('submit', async (evento) => {
  evento.preventDefault()

  const id = categoriaIdInput?.value
  const nome = categoriaNomeInput?.value ?? ''
  const tipo = categoriaTipoSelect?.value as 'receita' | 'despesa'

  try {
    if (id) {
      await window.api.atualizarCategoria(Number(id), nome, tipo)
      if (msgCategoriaEl) msgCategoriaEl.textContent = 'Categoria atualizada!'
    } else {
      await window.api.criarCategoria(nome, tipo)
      if (msgCategoriaEl) msgCategoriaEl.textContent = 'Categoria criada!'
    }

    limparFormularioCategoria()
    await carregarCategorias()
  } catch (erro: unknown) {
    if (msgCategoriaEl && erro instanceof Error) {
      msgCategoriaEl.textContent = `Erro: ${erro.message}`
    }
  }
})

botaoCancelarCategoria?.addEventListener('click', limparFormularioCategoria)

// ===================== TRANSAÇÕES =====================

const formTransacao = document.getElementById(
  'form-transacao'
) as HTMLFormElement | null
const transacaoIdInput = document.getElementById(
  'transacao-id'
) as HTMLInputElement | null
const transacaoDescricaoInput = document.getElementById(
  'transacao-descricao'
) as HTMLInputElement | null
const transacaoValorInput = document.getElementById(
  'transacao-valor'
) as HTMLInputElement | null
const transacaoDataInput = document.getElementById(
  'transacao-data'
) as HTMLInputElement | null
const listaTransacoesEl = document.getElementById('lista-transacoes')
const msgTransacaoEl = document.getElementById('msg-transacao')
const botaoCancelarTransacao = document.getElementById(
  'btn-cancelar-transacao'
)

const filtroTipoSelect = document.getElementById(
  'filtro-tipo'
) as HTMLSelectElement | null
const filtroDataInicioInput = document.getElementById(
  'filtro-data-inicio'
) as HTMLInputElement | null
const filtroDataFimInput = document.getElementById(
  'filtro-data-fim'
) as HTMLInputElement | null
const botaoFiltrar = document.getElementById('btn-filtrar')
const botaoLimparFiltro = document.getElementById('btn-limpar-filtro')

function limparFormularioTransacao() {
  if (transacaoIdInput) transacaoIdInput.value = ''
  if (transacaoDescricaoInput) transacaoDescricaoInput.value = ''
  if (transacaoValorInput) transacaoValorInput.value = ''
  if (transacaoDataInput) transacaoDataInput.value = ''
  if (selectTransacaoCategoria) selectTransacaoCategoria.value = ''
}

async function carregarTransacoes() {
  const filtros = {
    tipo: (filtroTipoSelect?.value || undefined) as
      | 'receita'
      | 'despesa'
      | undefined,
    idCategoria: selectFiltroCategoria?.value
      ? Number(selectFiltroCategoria.value)
      : undefined,
    dataInicio: filtroDataInicioInput?.value || undefined,
    dataFim: filtroDataFimInput?.value || undefined,
  }

  const transacoes = await window.api.listarTransacoes(filtros)

  if (!listaTransacoesEl) return

  listaTransacoesEl.innerHTML = ''

  transacoes.forEach((transacao) => {
    const item = document.createElement('li')
    const valorFormatado = formatarMoeda(Number(transacao.valor))
    const dataFormatada = new Date(transacao.data).toLocaleDateString(
      'pt-BR'
    )

    item.textContent = `${dataFormatada} - ${transacao.descricao} - ${valorFormatado} (${transacao.categoria_nome}) `

    const botaoEditar = document.createElement('button')
    botaoEditar.textContent = 'Editar'
    botaoEditar.addEventListener('click', () => {
      if (transacaoIdInput) transacaoIdInput.value = String(transacao.id)
      if (transacaoDescricaoInput)
        transacaoDescricaoInput.value = transacao.descricao
      if (transacaoValorInput)
        transacaoValorInput.value = String(transacao.valor)
      if (transacaoDataInput)
        transacaoDataInput.value = transacao.data.slice(0, 10)
      if (selectTransacaoCategoria)
        selectTransacaoCategoria.value = String(transacao.id_categoria)
    })

    const botaoExcluir = document.createElement('button')
    botaoExcluir.textContent = 'Excluir'
    botaoExcluir.addEventListener('click', async () => {
      await window.api.deletarTransacao(transacao.id)
      await carregarTransacoes()
      await atualizarSaldo()
    })

    item.appendChild(botaoEditar)
    item.appendChild(botaoExcluir)
    listaTransacoesEl.appendChild(item)
  })
}

formTransacao?.addEventListener('submit', async (evento) => {
  evento.preventDefault()

  const id = transacaoIdInput?.value
  const descricao = transacaoDescricaoInput?.value ?? ''
  const valor = Number(transacaoValorInput?.value)
  const data = transacaoDataInput?.value ?? ''
  const idCategoria = Number(selectTransacaoCategoria?.value)

  try {
    if (id) {
      await window.api.atualizarTransacao(
        Number(id),
        descricao,
        valor,
        data,
        idCategoria
      )
      if (msgTransacaoEl) msgTransacaoEl.textContent = 'Transação atualizada!'
    } else {
      await window.api.criarTransacao(descricao, valor, data, idCategoria)
      if (msgTransacaoEl) msgTransacaoEl.textContent = 'Transação criada!'
    }

    limparFormularioTransacao()
    await carregarTransacoes()
    await atualizarSaldo()
  } catch (erro: unknown) {
    if (msgTransacaoEl && erro instanceof Error) {
      msgTransacaoEl.textContent = `Erro: ${erro.message}`
    }
  }
})

botaoCancelarTransacao?.addEventListener('click', limparFormularioTransacao)

botaoFiltrar?.addEventListener('click', carregarTransacoes)

botaoLimparFiltro?.addEventListener('click', () => {
  if (filtroTipoSelect) filtroTipoSelect.value = ''
  if (selectFiltroCategoria) selectFiltroCategoria.value = ''
  if (filtroDataInicioInput) filtroDataInicioInput.value = ''
  if (filtroDataFimInput) filtroDataFimInput.value = ''
  carregarTransacoes()
})

// ===================== INICIALIZAÇÃO =====================

async function iniciar() {
  await carregarCategorias()
  await carregarTransacoes()
  await atualizarSaldo()
  await carregarFormasPagamento()
}

iniciar()