CREATE TABLE IF NOT EXISTS categorias (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('receita', 'despesa'))
);

CREATE TABLE IF NOT EXISTS formas_pagamento (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transacoes (
  id SERIAL PRIMARY KEY,
  descricao TEXT NOT NULL,
  valor NUMERIC(10,2) NOT NULL,
  data DATE NOT NULL,
  id_categoria INTEGER NOT NULL REFERENCES categorias(id),
  id_forma_pagamento INTEGER REFERENCES formas_pagamento(id)
);

CREATE INDEX IF NOT EXISTS idx_transacoes_id_categoria
ON transacoes(id_categoria);

CREATE INDEX IF NOT EXISTS idx_transacoes_id_forma_pagamento
ON transacoes(id_forma_pagamento);

CREATE INDEX IF NOT EXISTS dados_de_transações_idx
ON transacoes(data);

INSERT INTO formas_pagamento (nome, descricao)
VALUES
  ('Dinheiro', 'Pagamento em espécie'),
  ('Pix', 'Transferência instantânea'),
  ('Cartão de Débito', 'Débito direto na conta'),
  ('Cartão de Crédito', 'Pagamento a prazo'),
  ('Boleto', 'Pagamento via boleto bancário');