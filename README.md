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

### Resumo Mensal

- Receitas do mês
- Despesas do mês
- Total movimentado
- Transações registradas

### Formas de Pagamento

- Integração com transações
- Seleção no cadastro de transações
- Preenchimento automático da forma PIX durante a leitura de comprovantes

### OCR de Comprovantes PIX

Leitura automática de comprovantes utilizando Tesseract.js.

O sistema é capaz de identificar:

- Valor da transação
- Data da transação
- Forma de pagamento PIX

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

O banco de dados utilizado é PostgreSQL.

Antes de executar a aplicação execute:

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

Modelo disponível 