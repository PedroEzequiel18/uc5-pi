# UC5 - Exercícios Módulo 1: IPC com Electron + Vite + TypeScript

Projeto de referência para exercícios de comunicação entre processos (IPC)
em aplicações Electron. Cada branch representa uma evolução cumulativa do projeto.

## Branches

| Branch          | Conteúdo                                                    |
|-----------------|-------------------------------------------------------------|
| `main`          | Boilerplate base: Electron + Vite + TypeScript              |
| `mod01/ex01`    | Exercício 1 - Informações de hardware (módulo `os`)         |
| `mod01/ex02`    | Exercício 2 - Calculadora de IMC                            |
| `mod01/ex03`    | Exercício 3 - Gravador de logs (módulo `fs`)                |

## Como usar

```bash
git clone https://github.com/thalsime/uc5-desktop-mod1-ipc.git
cd uc5-desktop-mod1-ipc
npm install
npm run dev
```

Para ver a solução de um exercício específico:

```bash
git checkout mod01/ex01
```

## Requisitos

- Node.js 22+ (LTS ativo; o Electron 42 embute o Node 24 internamente)
- npm 10+

## Stack

- Electron 42
- Vite 8
- TypeScript 5 (modo estrito)
- `vite-plugin-electron`
