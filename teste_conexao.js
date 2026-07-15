require('dotenv').config();
const { Client } = require('pg');
async function testar() {
const cliente = new Client({ connectionString: process.env.DATABASE_URL });
await cliente.connect();
const resultado = await cliente.query('SELECT NOW() AS agora');
console.log('Conectado! Hora do servidor:'
, resultado.rows[0].agora);
await cliente.end();
}
testar().catch((erro) => console.error('Falha na conexao:'
, erro.message));