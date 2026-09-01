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
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// ===================== PING (boilerplate) =====================

const botaoPing = document.getElementById("btn-ping");
const respostaPing = document.getElementById("resposta");

botaoPing?.addEventListener("click", async () => {
  const resposta = await window.api.ping();
  if (respostaPing) respostaPing.textContent = resposta;
});

// ===================== DADOS DA MÁQUINA E LOG (sem depender do banco) =====================

const botaoDadosMaquina = document.getElementById("btn-dados-maquina");
const resultadoDadosMaquinaEl = document.getElementById(
  "resultado-dados-maquina",
);

botaoDadosMaquina?.addEventListener("click", async () => {
  const dados = await window.api.obterDadosMaquina();
  if (resultadoDadosMaquinaEl) {
    resultadoDadosMaquinaEl.textContent = `${dados.plataforma} - ${dados.processador} - ${dados.memoriaRam}`;
  }
});

const formLogEl = document.getElementById("form-log") as HTMLFormElement | null;
const inputLogEl = document.getElementById(
  "texto-log",
) as HTMLInputElement | null;
const statusLogEl = document.getElementById("status-log");

formLogEl?.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const mensagem = inputLogEl?.value ?? "";
  const salvou = await window.api.escreverLog(mensagem);

  if (statusLogEl) {
    statusLogEl.textContent = salvou
      ? "Log salvo em logs.txt!"
      : "Não foi possível salvar o log.";
  }
  if (salvou && inputLogEl) inputLogEl.value = "";
});

// ===================== NAVEGAÇÃO EM ABAS =====================

const botoesAba = document.querySelectorAll<HTMLButtonElement>(".aba-botao");
const paineisAba = document.querySelectorAll<HTMLElement>(".aba-painel");

botoesAba.forEach((botao) => {
  botao.addEventListener("click", () => {
    const abaAlvo = botao.dataset.aba;

    botoesAba.forEach((outroBotao) => {
      outroBotao.classList.toggle("ativo", outroBotao === botao);
    });

    paineisAba.forEach((painel) => {
      painel.hidden = painel.dataset.abaPainel !== abaAlvo;
    });
  });
});

// ===================== FORMAS DE PAGAMENTO =====================

const listaFormasPagamentoEl = document.getElementById(
  "lista-formas-pagamento",
);
const formBuscaPagamentoEl = document.getElementById(
  "form-busca-pagamento",
) as HTMLFormElement | null;
const inputBuscaPagamentoEl = document.getElementById(
  "busca-formas-pagamento",
) as HTMLInputElement | null;
const erroBuscaPagamentoEl = document.getElementById("erro-busca-pagamento");
const statusBuscaPagamentoEl = document.getElementById(
  "status-busca-pagamento",
);

const selectTransacaoFormaPagamento = document.getElementById(
  "transacao-forma-pagamento",
) as HTMLSelectElement | null;

async function carregarFormasPagamento(termo?: string) {
  if (!listaFormasPagamentoEl) return;

  try {
    const formasPagamento = await window.api.listarFormasPagamento(termo);

    if (erroBuscaPagamentoEl) erroBuscaPagamentoEl.textContent = "";
    listaFormasPagamentoEl.innerHTML = "";

    if (formasPagamento.length === 0) {
      if (statusBuscaPagamentoEl)
        statusBuscaPagamentoEl.textContent =
          "Nenhuma forma de pagamento encontrada.";
      return;
    }

    if (statusBuscaPagamentoEl) statusBuscaPagamentoEl.textContent = "";

    formasPagamento.forEach((forma) => {
      const item = document.createElement("li");
      item.textContent = `${forma.nome} - ${forma.descricao}`;
      listaFormasPagamentoEl.appendChild(item);
    });
  } catch (erro: unknown) {
    listaFormasPagamentoEl.innerHTML = "";
    if (statusBuscaPagamentoEl) statusBuscaPagamentoEl.textContent = "";
    if (erroBuscaPagamentoEl && erro instanceof Error) {
      erroBuscaPagamentoEl.textContent = erro.message;
    }
  }
}

async function carregarSelectFormasPagamento() {
  if (!selectTransacaoFormaPagamento) return;

  const formasPagamento = await window.api.listarFormasPagamento();

  const valorAtual = selectTransacaoFormaPagamento.value;
  const primeiraOpcao = selectTransacaoFormaPagamento.options[0];
  selectTransacaoFormaPagamento.innerHTML = "";
  selectTransacaoFormaPagamento.appendChild(primeiraOpcao);

  formasPagamento.forEach((forma) => {
    const opcao = document.createElement("option");
    opcao.value = String(forma.id);
    opcao.textContent = forma.nome;
    selectTransacaoFormaPagamento.appendChild(opcao);
  });

  selectTransacaoFormaPagamento.value = valorAtual;
}

formBuscaPagamentoEl?.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const termo = inputBuscaPagamentoEl?.value ?? "";
  await carregarFormasPagamento(termo);
});

inputBuscaPagamentoEl?.addEventListener("input", () => {
  if (!listaFormasPagamentoEl) return;

  const termoDigitado = inputBuscaPagamentoEl.value.trim().toLowerCase();
  const itens = listaFormasPagamentoEl.querySelectorAll("li");

  itens.forEach((item) => {
    const texto = item.textContent?.toLowerCase() ?? "";
    const corresponde = texto.includes(termoDigitado);
    item.style.display = corresponde ? "" : "none";
  });
});

// ===================== SALDO =====================

const botaoAtualizarSaldo = document.getElementById("btn-atualizar-saldo");
const saldoReceitasEl = document.getElementById("saldo-receitas");
const saldoDespesasEl = document.getElementById("saldo-despesas");
const saldoTotalEl = document.getElementById("saldo-total");

async function atualizarSaldo() {
  const { totalReceitas, totalDespesas, saldo } = await window.api.obterSaldo();

  if (saldoReceitasEl) {
    saldoReceitasEl.textContent = `Receitas: ${formatarMoeda(totalReceitas)}`;
  }

  if (saldoDespesasEl) {
    saldoDespesasEl.textContent = `Despesas: ${formatarMoeda(totalDespesas)}`;
  }

  if (saldoTotalEl) {
    saldoTotalEl.textContent = `Saldo: ${formatarMoeda(saldo)}`;
  }
}

botaoAtualizarSaldo?.addEventListener("click", atualizarSaldo);

// ===================== CATEGORIAS =====================

const formCategoria = document.getElementById(
  "form-categoria",
) as HTMLFormElement | null;
const categoriaIdInput = document.getElementById(
  "categoria-id",
) as HTMLInputElement | null;
const categoriaNomeInput = document.getElementById(
  "categoria-nome",
) as HTMLInputElement | null;
const categoriaTipoSelect = document.getElementById(
  "categoria-tipo",
) as HTMLSelectElement | null;
const listaCategoriasEl = document.getElementById("lista-categorias");
const msgCategoriaEl = document.getElementById("msg-categoria");
const botaoCancelarCategoria = document.getElementById(
  "btn-cancelar-categoria",
);

const selectTransacaoCategoria = document.getElementById(
  "transacao-categoria",
) as HTMLSelectElement | null;
const selectFiltroCategoria = document.getElementById(
  "filtro-categoria",
) as HTMLSelectElement | null;

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
      const item = document.createElement("li");
      item.textContent = `${categoria.nome} (${categoria.tipo}) `;

      const botaoEditar = document.createElement("button");
      botaoEditar.textContent = "Editar";
      botaoEditar.addEventListener("click", () => {
        if (categoriaIdInput) categoriaIdInput.value = String(categoria.id);
        if (categoriaNomeInput) categoriaNomeInput.value = categoria.nome;
        if (categoriaTipoSelect) categoriaTipoSelect.value = categoria.tipo;
      });

      const botaoExcluir = document.createElement("button");
      botaoExcluir.textContent = "Excluir";
      botaoExcluir.addEventListener("click", async () => {
        try {
          await window.api.deletarCategoria(categoria.id);
          if (msgCategoriaEl)
            msgCategoriaEl.textContent = "Categoria excluída!";
          await carregarCategorias();
          await carregarTransacoes();
        } catch (erro: unknown) {
          if (msgCategoriaEl && erro instanceof Error) {
            msgCategoriaEl.textContent = erro.message.replace(
              /^Error invoking remote method '.*?': Error:\s*/,
              "",
            );
          }
        }
      });

      item.appendChild(botaoEditar);
      item.appendChild(botaoExcluir);
      listaCategoriasEl.appendChild(item);
    });
  }

  [selectTransacaoCategoria, selectFiltroCategoria].forEach((select) => {
    if (!select) return;

    const valorAtual = select.value;
    const primeiraOpcao = select.options[0];
    select.innerHTML = "";
    select.appendChild(primeiraOpcao);

    categorias.forEach((categoria) => {
      const opcao = document.createElement("option");
      opcao.value = String(categoria.id);
      opcao.textContent = `${categoria.nome} (${categoria.tipo})`;
      select.appendChild(opcao);
    });

    select.value = valorAtual;
  });
}

formCategoria?.addEventListener("submit", async (evento) => {
  evento.preventDefault();

  const id = categoriaIdInput?.value;
  const nome = categoriaNomeInput?.value ?? "";
  const tipo = categoriaTipoSelect?.value as "receita" | "despesa";

  try {
    if (id) {
      await window.api.atualizarCategoria(Number(id), nome, tipo);
      if (msgCategoriaEl) msgCategoriaEl.textContent = "Categoria atualizada!";
    } else {
      await window.api.criarCategoria(nome, tipo);
      if (msgCategoriaEl) msgCategoriaEl.textContent = "Categoria criada!";
    }

    limparFormularioCategoria();
    await carregarCategorias();
  } catch (erro: unknown) {
    if (msgCategoriaEl && erro instanceof Error) {
      msgCategoriaEl.textContent = erro.message.replace(
        /^Error invoking remote method '.*?': Error:\s*/,
        "",
      );
    }
  }
});

botaoCancelarCategoria?.addEventListener("click", limparFormularioCategoria);

// ===================== TRANSAÇÕES =====================

const formTransacao = document.getElementById(
  "form-transacao",
) as HTMLFormElement | null;
const transacaoIdInput = document.getElementById(
  "transacao-id",
) as HTMLInputElement | null;
const transacaoDescricaoInput = document.getElementById(
  "transacao-descricao",
) as HTMLInputElement | null;
const transacaoValorInput = document.getElementById(
  "transacao-valor",
) as HTMLInputElement | null;
const transacaoDataInput = document.getElementById(
  "transacao-data",
) as HTMLInputElement | null;
const listaTransacoesEl = document.getElementById("lista-transacoes");
const msgTransacaoEl = document.getElementById("msg-transacao");
const botaoCancelarTransacao = document.getElementById(
  "btn-cancelar-transacao",
);

// ===================== LEITOR DE COMPROVANTE PIX =====================

const inputComprovanteEl = document.getElementById(
  "input-comprovante-pix",
) as HTMLInputElement | null;
const statusComprovanteEl = document.getElementById("status-comprovante-pix");

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

  if (statusComprovanteEl)
    statusComprovanteEl.textContent = "Lendo comprovante, aguarde...";

  try {
    const imagemBase64 = await lerArquivoComoBase64(arquivo);
    const { valorDetectado, dataDetectada } =
      await window.api.lerComprovantePix(imagemBase64);

    if (transacaoValorInput && valorDetectado !== null) {
      transacaoValorInput.value = String(valorDetectado);
    }
    if (transacaoDataInput && dataDetectada !== null) {
      transacaoDataInput.value = dataDetectada;
    }
    if (selectTransacaoFormaPagamento) {
      const opcaoPix = Array.from(selectTransacaoFormaPagamento.options).find(
        (opcao) => opcao.textContent?.toLowerCase() === "pix",
      );

      if (opcaoPix) {
        selectTransacaoFormaPagamento.value = opcaoPix.value;
      }
    }

    if (valorDetectado === null && dataDetectada === null) {
      if (statusComprovanteEl)
        statusComprovanteEl.textContent =
          "Não consegui identificar valor ou data - preencha manualmente.";
    } else {
      if (statusComprovanteEl)
        statusComprovanteEl.textContent =
          "Comprovante lido! Confira os dados antes de salvar.";
    }
  } catch (erro: unknown) {
    if (statusComprovanteEl && erro instanceof Error) {
      statusComprovanteEl.textContent = `Erro ao ler comprovante: ${erro.message}`;
    }
  }
});

const filtroTipoSelect = document.getElementById(
  "filtro-tipo",
) as HTMLSelectElement | null;
const filtroDataInicioInput = document.getElementById(
  "filtro-data-inicio",
) as HTMLInputElement | null;
const filtroDataFimInput = document.getElementById(
  "filtro-data-fim",
) as HTMLInputElement | null;
const botaoFiltrar = document.getElementById("btn-filtrar");
const botaoLimparFiltro = document.getElementById("btn-limpar-filtro");

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
    tipo: (filtroTipoSelect?.value || undefined) as
      | "receita"
      | "despesa"
      | undefined,
    idCategoria: selectFiltroCategoria?.value
      ? Number(selectFiltroCategoria.value)
      : undefined,
    dataInicio: filtroDataInicioInput?.value || undefined,
    dataFim: filtroDataFimInput?.value || undefined,
  };

  const transacoes = await window.api.listarTransacoes(filtros);

  if (!listaTransacoesEl) return;

  listaTransacoesEl.innerHTML = "";

  transacoes.forEach((transacao) => {
    const item = document.createElement("li");
    const valorFormatado = formatarMoeda(Number(transacao.valor));
    const dataFormatada = new Date(transacao.data).toLocaleDateString("pt-BR");
    const sufixoFormaPagamento = transacao.forma_pagamento_nome
      ? ` · ${transacao.forma_pagamento_nome}`
      : "";

    item.textContent = `${dataFormatada} - ${transacao.descricao} - ${valorFormatado} (${transacao.categoria_nome}${sufixoFormaPagamento}) `;

    const botaoEditar = document.createElement("button");
    botaoEditar.textContent = "Editar";
    botaoEditar.addEventListener("click", () => {
      if (transacaoIdInput) transacaoIdInput.value = String(transacao.id);
      if (transacaoDescricaoInput)
        transacaoDescricaoInput.value = transacao.descricao;
      if (transacaoValorInput)
        transacaoValorInput.value = String(transacao.valor);
      if (transacaoDataInput)
        transacaoDataInput.value = transacao.data.slice(0, 10);
      if (selectTransacaoCategoria)
        selectTransacaoCategoria.value = String(transacao.id_categoria);
      if (selectTransacaoFormaPagamento)
        selectTransacaoFormaPagamento.value = transacao.id_forma_pagamento
          ? String(transacao.id_forma_pagamento)
          : "";
    });

    const botaoExcluir = document.createElement("button");
    botaoExcluir.textContent = "Excluir";
    botaoExcluir.addEventListener("click", async () => {
      await window.api.deletarTransacao(transacao.id);
      await carregarTransacoes();
      await atualizarSaldo();
    });

    item.appendChild(botaoEditar);
    item.appendChild(botaoExcluir);
    listaTransacoesEl.appendChild(item);
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
      await window.api.atualizarTransacao(
        Number(id),
        descricao,
        valor,
        data,
        idCategoria,
        idFormaPagamento,
      );
      if (msgTransacaoEl) msgTransacaoEl.textContent = "Transação atualizada!";
    } else {
      await window.api.criarTransacao(
        descricao,
        valor,
        data,
        idCategoria,
        idFormaPagamento,
      );
      if (msgTransacaoEl) msgTransacaoEl.textContent = "Transação criada!";
    }

    limparFormularioTransacao();
    await carregarTransacoes();
    await atualizarSaldo();
  } catch (erro: unknown) {
    if (msgTransacaoEl && erro instanceof Error) {
      msgTransacaoEl.textContent = erro.message.replace(
        /^Error invoking remote method '.*?': Error:\s*/,
        "",
      );
    }
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
