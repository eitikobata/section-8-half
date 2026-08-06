// Script descartável, só pra ver os eventos do Bloco 3 chegando sem front.
// Uso: node listen-socket.js (com o backend já rodando em outro terminal)
const { io } = require('socket.io-client');

const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log(`[socket] connected as ${socket.id}, watching for events...`);
});

socket.on('incident.created', (incident) => {
  console.log('\n>>> incident.created', incident);
});

socket.on('incident.updated', (patch) => {
  console.log('\n>>> incident.updated', patch);
});

socket.on('incident.comment', (comment) => {
  console.log('\n>>> incident.comment', comment);
});

socket.on('disconnect', () => {
  console.log('[socket] disconnected');
});
