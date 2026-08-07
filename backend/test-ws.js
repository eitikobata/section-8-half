const { io } = require('socket.io-client');

const token = process.argv[2]; // passa o accessToken como argumento

const socket = io('http://localhost:3000', {
  auth: { token },
});

socket.on('connect', () => console.log('✅ conectado:', socket.id));
socket.on('disconnect', () => console.log('❌ desconectado'));
socket.on('incident.created', (data) => console.log('incident.created:', data));
socket.on('incident.updated', (data) => console.log('incident.updated:', data));
