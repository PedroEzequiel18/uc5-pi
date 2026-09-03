export {};

declare global {
  interface Window {
    api: {
      ping: () => Promise<string>;
      obterDadosMaquina: () => Promise<{
        plataforma: string;
        processador: string;
        memoriaRam: string;
      }>;
      escreverLog: (mensagem: string) => Promise<boolean>;
      listarFormasPagamento: (termo?: string) => Promise<FormaPagamento[]>;
      lerComprovantePix: (imagemBase64: string) => Promise<{
        textoDetectado: string;
        valorDetectado: number | null;
        dataDetectada: string | null;
      }>;

      listarCategorias: () => Promise<Categoria[]>;
      criarCategoria: (
        nome: string,
        tipo: "receita" | "despesa",
      ) => Promise<Categoria>;
      atualizarCategoria: (
        id: number,
        nome: string,
        tipo: "receita" | "despesa",
      ) => Promise<Categoria>;
      deletarCategoria: (id: number) => Promise<boolean>;

      listarTransacoes: (filtros?: {
        tipo?: "receita" | "despesa";
        idCategoria?: number;
        dataInicio?: string;
        dataFim?: string;
      }) => Promise<Transacao[]>;
      criarTransacao: (
        descricao: string,
        valor: number,
        data: string,
        idCategoria: number,
        idFormaPagamento: number | null,
      ) => Promise<Transacao>;
      atualizarTransacao: (
        id: number,
        descricao: string,
        valor: number,
        data: string,
        idCategoria: number,
        idFormaPagamento: number | null,
      ) => Promise<Transacao>;
      deletarTransacao: (id: number) => Promise<boolean>;

      obterSaldo: () => Promise<{
        totalReceitas: number;
        totalDespesas: number;
        saldo: number;
      }>;
    };
  }
}

interface Categoria {
  id: number;
  nome: string;
  tipo: "receita" | "despesa";
}

interface FormaPagamento {
  id: number;
  nome: string;
  descricao: string;
}

interface Transacao {
  id: number;
  descricao: string;
  valor: string;
  data: string;
  id_categoria: number;
  categoria_nome: string;
  categoria_tipo: "receita" | "despesa";
  id_forma_pagamento: number | null;
  forma_pagamento_nome: string | null;
}

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ===================== HELPERS DE DOM =====================

function $<T extends HTMLElement = HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function definirTexto(el: HTMLElement | null, texto: string) {
  if (el) el.textContent = texto;
}

// Erros vindos do IPC chegam com o prefixo padrão do Electron -
// aqui a gente tira isso pra mostrar só a mensagem de negócio.
function mensagemDeErro(erro: unknown): string | null {
  if (!(erro instanceof Error)) return null;
  return erro.message.replace(/^Error invoking remote method '.*?': Error:\s*/, "");
}

function criarItemComAcoes(
  texto: string,
  acoes: { rotulo: string; aoClicar: () => void }[] = [],
): HTMLLIElement {
  const item = document.createElement("li");
  item.textContent = texto;
  acoes.forEach(({ rotulo, aoClicar }) => {
    const botao = document.createElement("button");
    botao.textContent = rotulo;
    botao.addEventListener("click", aoClicar);
    item.appendChild(botao);
  });
  return item;
}

// Preenche um <select> preservando a opção padrão (primeira) e o valor
// selecionado antes da atualização, se ele ainda existir na nova lista.
function preencherSelect<T extends { id: number }>(
  select: HTMLSelectElement | null,
  itens: T[],
  rotulo: (item: T) => string,
) {
  if (!select) return;
  const valorAtual = select.value;
  const primeiraOpcao = select.options[0];
  select.innerHTML = "";
  select.appendChild(primeiraOpcao);

  itens.forEach((item) => {
    const opcao = document.createElement("option");
    opcao.value = String(item.id);
    opcao.textContent = rotulo(item);
    select.appendChild(opcao);
  });
  select.value = valorAtual;
}

// ===================== PING (boilerplate) =====================

const botaoPing = $("btn-ping");
const respostaPing = $("resposta");

botaoPing?.addEventListener("click", async () => {
  definirTexto(respostaPing, await window.api.ping());
});

// ===================== DADOS DA MÁQUINA E LOG (sem depender do banco) =====================

const botaoDadosMaquina = $("btn-dados-maquina");
const resultadoDadosMaquinaEl = $("resultado-dados-maquina");

botaoDadosMaquina?.addEventListener("click", async () => {
  const dados = await window.api.obterDadosMaquina();
  definirTexto(
    resultadoDadosMaquinaEl,
    `${dados.plataforma} - ${dados.processador} - ${dados.memoriaRam}`,
  );
});

const formLogEl = $<HTMLFormElement>("form-log");
const inputLogEl = $<HTMLInputElement>("texto-log");
const statusLogEl = $("status-log");

formLogEl?.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const salvou = await window.api.escreverLog(inputLogEl?.value ?? "");
  definirTexto(statusLogEl, salvou ? "Log salvo em logs.txt!" : "Não foi possível salvar o log.");
  if (salvou && inputLogEl) inputLogEl.value = "";
});

// ===================== NAVEGAÇÃO EM ABAS =====================

const botoesAba = document.querySelectorAll<HTMLButtonElement>(".aba-botao");
const paineisAba = document.querySelectorAll<HTMLElement>(".aba-painel");

botoesAba.forEach((botao) => {
  botao.addEventListener("click", () => {
    const abaAlvo = botao.dataset.aba;
    botoesAba.forEach((outroBotao) => outroBotao.classList.toggle("ativo", outroBotao === botao));
    paineisAba.forEach((painel) => {
      painel.hidden = painel.dataset.abaPainel !== abaAlvo;
    });
  });
});

// ===================== FORMAS DE PAGAMENTO =====================

const listaFormasPagamentoEl = $("lista-formas-pagamento");
const formBuscaPagamentoEl = $<HTMLFormElement>("form-busca-pagamento");
const inputBuscaPagamentoEl = $<HTMLInputElement>("busca-formas-pagamento");
const erroBuscaPagamentoEl = $("erro-busca-pagamento");
const statusBuscaPagamentoEl = $("status-busca-pagamento");

const selectTransacaoFormaPagamento = $<HTMLSelectElement>("transacao-forma-pagamento");

async function carregarFormasPagamento(termo?: string) {
  if (!listaFormasPagamentoEl) return;

  try {
    const formasPagamento = await window.api.listarFormasPagamento(termo);
    definirTexto(erroBuscaPagamentoEl, "");
    listaFormasPagamentoEl.innerHTML = "";

    if (formasPagamento.length === 0) {
      definirTexto(statusBuscaPagamentoEl, "Nenhuma forma de pagamento encontrada.");
      return;
    }

    definirTexto(statusBuscaPagamentoEl, "");
    formasPagamento.forEach((forma) => {
      listaFormasPagamentoEl.appendChild(criarItemComAcoes(`${forma.nome} - ${forma.descricao}`));
    });
  } catch (erro: unknown) {
    listaFormasPagamentoEl.innerHTML = "";
    definirTexto(statusBuscaPagamentoEl, "");
    if (erro instanceof Error) definirTexto(erroBuscaPagamentoEl, erro.message);
  }
}

async function carregarSelectFormasPagamento() {
  const formasPagamento = await window.api.listarFormasPagamento();
  preencherSelect(selectTransacaoFormaPagamento, formasPagamento, (f) => f.nome);
}

formBuscaPagamentoEl?.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  await carregarFormasPagamento(inputBuscaPagamentoEl?.value ?? "");
});

inputBuscaPagamentoEl?.addEventListener("input", async () => {
  const termo = inputBuscaPagamentoEl.value.trim();
  if (termo.length === 0) return carregarFormasPagamento();
  if (termo.length < 2) return;

  try {
    await carregarFormasPagamento(termo);
  } catch (erro) {
    console.error(erro);
  }
});

// ===================== SALDO =====================

const botaoAtualizarSaldo = $("btn-atualizar-saldo");
const saldoReceitasEl = $("saldo-receitas");
const saldoDespesasEl = $("saldo-despesas");
const saldoTotalEl = $("saldo-total");
const resumoReceitasMesEl = $("resumo-receitas-mes");
const resumoDespesasMesEl = $("resumo-despesas-mes");
const resumoTotalMesEl = $("resumo-total-mes");
const resumoQuantidadeTransacoesEl = $("resumo-quantidade-transacoes");

async function atualizarSaldo() {
  const { totalReceitas, totalDespesas, saldo } = await window.api.obterSaldo();

  definirTexto(saldoReceitasEl, `Receitas: ${formatarMoeda(totalReceitas)}`);
  definirTexto(saldoDespesasEl, `Despesas: ${formatarMoeda(totalDespesas)}`);
  definirTexto(saldoTotalEl, `Saldo: ${formatarMoeda(saldo)}`);
  definirTexto(resumoReceitasMesEl, `Receitas do mês: ${formatarMoeda(totalReceitas)}`);
  definirTexto(resumoDespesasMesEl, `Despesas do mês: ${formatarMoeda(totalDespesas)}`);
  definirTexto(resumoTotalMesEl, `Total movimentado: ${formatarMoeda(totalReceitas + totalDespesas)}`);
}

botaoAtualizarSaldo?.addEventListener("click", atualizarSaldo);

// ===================== CATEGORIAS =====================

const formCategoria = $<HTMLFormElement>("form-categoria");
const categoriaIdInput = $<HTMLInputElement>("categoria-id");
const categoriaNomeInput = $<HTMLInputElement>("categoria-nome");
const categoriaTipoSelect = $<HTMLSelectElement>("categoria-tipo");
const listaCategoriasEl = $("lista-categorias");
const msgCategoriaEl = $("msg-categoria");
const botaoCancelarCategoria = $("btn-cancelar-categoria");

const selectTransacaoCategoria = $<HTMLSelectElement>("transacao-categoria");
const selectFiltroCategoria = $<HTMLSelectElement>("filtro-categoria");

function limparFormularioCategoria() {
  if (categoriaIdInput) categoriaIdInput.value = "";
  if (categoriaNomeInput) categoriaNomeInput.value = "";
  if (categoriaTipoSelect) categoriaTipoSelect.value = "";
}

async function carregarCategorias() {
  const categorias = await window.api.listarCategorias();

  if (listaCategoriasEl) {
    listaCategoriasEl.innerHTML = "";
    categorias.forEach((categoria) => {
      listaCategoriasEl.appendChild(
        criarItemComAcoes(`${categoria.nome} (${categoria.tipo}) `, [
          {
            rotulo: "Editar",
            aoClicar: () => {
              if (categoriaIdInput) categoriaIdInput.value = String(categoria.id);
              if (categoriaNomeInput) categoriaNomeInput.value = categoria.nome;
              if (categoriaTipoSelect) categoriaTipoSelect.value = categoria.tipo;
            },
          },
          {
            rotulo: "Excluir",
            aoClicar: async () => {
              try {
                await window.api.deletarCategoria(categoria.id);
                definirTexto(msgCategoriaEl, "Categoria excluída!");
                await carregarCategorias();
                await carregarTransacoes();
              } catch (erro: unknown) {
                const mensagem = mensagemDeErro(erro);
                if (mensagem) definirTexto(msgCategoriaEl, mensagem);
              }
            },
          },
        ]),
      );
    });
  }

  [selectTransacaoCategoria, selectFiltroCategoria].forEach((select) =>
    preencherSelect(select, categorias, (c) => `${c.nome} (${c.tipo})`),
  );
}

formCategoria?.addEventListener("submit", async (evento) => {
  evento.preventDefault();

  const id = categoriaIdInput?.value;
  const nome = categoriaNomeInput?.value ?? "";
  const tipo = categoriaTipoSelect?.value as "receita" | "despesa";

  try {
    if (id) {
      await window.api.atualizarCategoria(Number(id), nome, tipo);
      definirTexto(msgCategoriaEl, "Categoria atualizada!");
    } else {
      await window.api.criarCategoria(nome, tipo);
      definirTexto(msgCategoriaEl, "Categoria criada!");
    }

    limparFormularioCategoria();
    await carregarCategorias();
  } catch (erro: unknown) {
    const mensagem = mensagemDeErro(erro);
    if (mensagem) definirTexto(msgCategoriaEl, mensagem);
  }
});

botaoCancelarCategoria?.addEventListener("click", limparFormularioCategoria);

// ===================== TRANSAÇÕES =====================

const formTransacao = $<HTMLFormElement>("form-transacao");
const transacaoIdInput = $<HTMLInputElement>("transacao-id");
const transacaoDescricaoInput = $<HTMLInputElement>("transacao-descricao");
const transacaoValorInput = $<HTMLInputElement>("transacao-valor");
const transacaoDataInput = $<HTMLInputElement>("transacao-data");
const listaTransacoesEl = $("lista-transacoes");
const msgTransacaoEl = $("msg-transacao");
const botaoCancelarTransacao = $("btn-cancelar-transacao");

// ===================== LEITOR DE COMPROVANTE PIX =====================

const inputComprovanteEl = $<HTMLInputElement>("input-comprovante-pix");
const statusComprovanteEl = $("status-comprovante-pix");

function lerArquivoComoBase64(arquivo: File): Promise<string> {
  return new Promise((resolve, rejeitar) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(leitor.result as string);
    leitor.onerror = () => rejeitar(leitor.error);
    leitor.readAsDataURL(arquivo);
  });
}

inputComprovanteEl?.addEventListener("change", async () => {
  const arquivo = inputComprovanteEl.files?.[0];
  if (!arquivo) return;

  definirTexto(statusComprovanteEl, "Lendo comprovante, aguarde...");

  try {
    const imagemBase64 = await lerArquivoComoBase64(arquivo);
    const { valorDetectado, dataDetectada } = await window.api.lerComprovantePix(imagemBase64);

    if (transacaoValorInput && valorDetectado !== null) transacaoValorInput.value = String(valorDetectado);
    if (transacaoDataInput && dataDetectada !== null) transacaoDataInput.value = dataDetectada;

    if (selectTransacaoFormaPagamento) {
      const opcaoPix = Array.from(selectTransacaoFormaPagamento.options).find(
        (opcao) => opcao.textContent?.toLowerCase() === "pix",
      );
      if (opcaoPix) selectTransacaoFormaPagamento.value = opcaoPix.value;
    }

    definirTexto(
      statusComprovanteEl,
      valorDetectado === null && dataDetectada === null
        ? "Não consegui identificar valor ou data - preencha manualmente."
        : "Comprovante lido! Confira os dados antes de salvar.",
    );
  } catch (erro: unknown) {
    if (erro instanceof Error) {
      definirTexto(statusComprovanteEl, `Erro ao ler comprovante: ${erro.message}`);
    }
  }
});

const filtroTipoSelect = $<HTMLSelectElement>("filtro-tipo");
const filtroDataInicioInput = $<HTMLInputElement>("filtro-data-inicio");
const filtroDataFimInput = $<HTMLInputElement>("filtro-data-fim");
const botaoFiltrar = $("btn-filtrar");
const botaoLimparFiltro = $("btn-limpar-filtro");

function limparFormularioTransacao() {
  if (transacaoIdInput) transacaoIdInput.value = "";
  if (transacaoDescricaoInput) transacaoDescricaoInput.value = "";
  if (transacaoValorInput) transacaoValorInput.value = "";
  if (transacaoDataInput) transacaoDataInput.value = "";
  if (selectTransacaoCategoria) selectTransacaoCategoria.value = "";
  if (selectTransacaoFormaPagamento) selectTransacaoFormaPagamento.value = "";
}

async function carregarTransacoes() {
  const filtros = {
    tipo: (filtroTipoSelect?.value || undefined) as "receita" | "despesa" | undefined,
    idCategoria: selectFiltroCategoria?.value ? Number(selectFiltroCategoria.value) : undefined,
    dataInicio: filtroDataInicioInput?.value || undefined,
    dataFim: filtroDataFimInput?.value || undefined,
  };

  const transacoes = await window.api.listarTransacoes(filtros);
  definirTexto(resumoQuantidadeTransacoesEl, `Transações registradas: ${transacoes.length}`);

  if (!listaTransacoesEl) return;
  listaTransacoesEl.innerHTML = "";

  transacoes.forEach((transacao) => {
    const valorFormatado = formatarMoeda(Number(transacao.valor));
    const dataFormatada = new Date(transacao.data).toLocaleDateString("pt-BR");
    const sufixoFormaPagamento = transacao.forma_pagamento_nome
      ? ` · ${transacao.forma_pagamento_nome}`
      : "";
    const texto = `${dataFormatada} - ${transacao.descricao} - ${valorFormatado} (${transacao.categoria_nome}${sufixoFormaPagamento}) `;

    listaTransacoesEl.appendChild(
      criarItemComAcoes(texto, [
        {
          rotulo: "Editar",
          aoClicar: () => {
            if (transacaoIdInput) transacaoIdInput.value = String(transacao.id);
            if (transacaoDescricaoInput) transacaoDescricaoInput.value = transacao.descricao;
            if (transacaoValorInput) transacaoValorInput.value = String(transacao.valor);
            if (transacaoDataInput) transacaoDataInput.value = transacao.data.slice(0, 10);
            if (selectTransacaoCategoria) selectTransacaoCategoria.value = String(transacao.id_categoria);
            if (selectTransacaoFormaPagamento) {
              selectTransacaoFormaPagamento.value = transacao.id_forma_pagamento
                ? String(transacao.id_forma_pagamento)
                : "";
            }
          },
        },
        {
          rotulo: "Excluir",
          aoClicar: async () => {
            await window.api.deletarTransacao(transacao.id);
            await carregarTransacoes();
            await atualizarSaldo();
          },
        },
      ]),
    );
  });
}

formTransacao?.addEventListener("submit", async (evento) => {
  evento.preventDefault();

  const id = transacaoIdInput?.value;
  const descricao = transacaoDescricaoInput?.value ?? "";
  const valor = Number(transacaoValorInput?.value);
  const data = transacaoDataInput?.value ?? "";
  const idCategoria = Number(selectTransacaoCategoria?.value);
  const idFormaPagamento = selectTransacaoFormaPagamento?.value
    ? Number(selectTransacaoFormaPagamento.value)
    : null;

  try {
    if (id) {
      await window.api.atualizarTransacao(Number(id), descricao, valor, data, idCategoria, idFormaPagamento);
      definirTexto(msgTransacaoEl, "Transação atualizada!");
    } else {
      await window.api.criarTransacao(descricao, valor, data, idCategoria, idFormaPagamento);
      definirTexto(msgTransacaoEl, "Transação criada!");
    }

    limparFormularioTransacao();
    await carregarTransacoes();
    await atualizarSaldo();
  } catch (erro: unknown) {
    const mensagem = mensagemDeErro(erro);
    if (mensagem) definirTexto(msgTransacaoEl, mensagem);
  }
});

botaoCancelarTransacao?.addEventListener("click", limparFormularioTransacao);
botaoFiltrar?.addEventListener("click", carregarTransacoes);

botaoLimparFiltro?.addEventListener("click", () => {
  if (filtroTipoSelect) filtroTipoSelect.value = "";
  if (selectFiltroCategoria) selectFiltroCategoria.value = "";
  if (filtroDataInicioInput) filtroDataInicioInput.value = "";
  if (filtroDataFimInput) filtroDataFimInput.value = "";
  carregarTransacoes();
});

// ===================== INICIALIZAÇÃO =====================

async function iniciar() {
  try {
    await carregarCategorias();
    await carregarTransacoes();
    await atualizarSaldo();
    await carregarFormasPagamento();
    await carregarSelectFormasPagamento();
  } catch (erro) {
    console.error(erro);
  }
}
iniciar();