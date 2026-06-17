import http from 'node:http';
import './db.js';
import { PORT } from './config.js';
import { createHttpHandler } from './http.js';
import { attachWebSocket, notifyUser } from './realtime.js';

const handler = createHttpHandler(notifyUser);
const server = http.createServer(handler);
attachWebSocket(server);

server.listen(PORT, () => {
  console.log(`\n  Telegram-clone server ishga tushdi`);
  console.log(`  HTTP/REST : http://localhost:${PORT}`);
  console.log(`  WebSocket : ws://localhost:${PORT}/ws\n`);
});
