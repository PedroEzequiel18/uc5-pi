# Gestor de Fluxo de Caixa

Aplicação desktop desenvolvida para o Projeto Integrador da UC5 - Desenvolver Aplicações Desktop, utilizando Electron, TypeScript e PostgreSQL.

## Funcionalidades

### Categorias

- Cadastro de categorias de Receita e Despesa
- Edição de categorias
- Exclusão de categorias
- Listagem de categorias

### Transações

- Cadastro de transações financeiras
- Edição de transações
- Exclusão de transações
- Listagem de transações
- Associação com categoria
- Associação opcional com forma de pagamento

### Filtros

- Filtro por tipo
- Filtro por categoria
- Filtro por período
- Atualização dinâmica da listagem

### Saldo Consolidado

- Total de receitas
- Total de despesas
- Cálculo automático do saldo

### Formas de Pagamento

- Consulta de formas de pagamento
- Busca por nome
- Integração com transações

### OCR de Comprovantes PIX

Leitura automática de comprovantes utilizando Tesseract.js.

O sistema é capaz de identificar:

- Valor da transação
- Data da transação

a partir da imagem enviada pelo usuário.

### Funcionalidades Electron

- Comunicação IPC segura
- Consulta de informações da máquina
- Registro de logs em arquivo
- Aplicação empacotada para Windows

---

## Tecnologias Utilizadas

- Electron
- TypeScript
- Vite
- PostgreSQL
- Node.js
- Tesseract.js
- Electron Builder

---

## Estrutura do Projeto

```text
src/
├── db.ts
├── main.ts
├── preload.ts
├── renderer.ts
├── style.css
└── types.ts

sql/
└── schema.sql

.env.example
package.json
README.md
```

---

## Banco de Dados

O banco de dados é PostgreSQL.

Antes de executar a aplicação, execute o script:

```text
sql/schema.sql
```

O script cria automaticamente:

- categorias
- formas_pagamento
- transacoes

incluindo relacionamentos, índices e chaves estrangeiras.

---

## Configuração

Crie um arquivo `.env` na raiz do projeto:

```env
DATABASE_URL=sua_connection_string_postgresql
```

Exemplo de modelo disponível em:

```text
.env.example
```

---

## Instalação

Instalar dependências:

```bash
npm install
```

---

## Executar em Desenvolvimento

```bash
npm run dev
```

---

## Gerar Instalador

```bash
npm run build
```

O instalador será gerado em:

```text
release/
```

---

## Comunicação IPC Implementada

- canal-ping
- obter-dados-maquina
- registrar-log
- listar-formas-pagamento
- ler-comprovante-pix
- listar-categorias
- criar-categoria
- atualizar-categoria
- deletar-categoria
- listar-transacoes
- criar-transacao
- atualizar-transacao
- deletar-transacao
- obter-saldo

---

## Segurança

- contextIsolation habilitado
- nodeIntegration desabilitado
- Banco acessado somente pelo processo Main
- Credenciais armazenadas em arquivo .env
- Consultas SQL parametrizadas
- Tratamento de erros em todos os handlers

---

## Referências

Electron

https://www.electronjs.org

Vite

https://vitejs.dev

PostgreSQL Driver (pg)

https://node-postgres.com

Tesseract.js

https://tesseract.projectnaptha.com

---

## Autor

Pedro Ezequiel Pontes da Silva

Projeto Integrador - UC5

Desenvolver Aplicações Desktop

SENAC