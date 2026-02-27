const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingInterval: 10000,
  pingTimeout: 5000,
});

const PORT = process.env.PORT || 3000;

// { socketId -> index } の対応マップ
const clientIndexMap = new Map();
let nextIndex = 0;

function getTotal() {
  return clientIndexMap.size;
}

function broadcastTotal() {
  io.emit('total_update', { total: getTotal() });
}

// 演出データのキャッシュ
let cachedPerformance = null;

app.get('/', (req, res) => {
  res.send('Magia Relay Server is running.');
});

io.on('connection', (socket) => {
  // インデックスを割り当て
  const index = nextIndex++;
  clientIndexMap.set(socket.id, index);

  // 接続クライアントに index と total を送信
  socket.emit('connection', { index, total: getTotal() });

  // 全クライアントに total をブロードキャスト
  broadcastTotal();

  // キャッシュ済み演出データがあれば新規接続者へ配信
  if (cachedPerformance !== null) {
    socket.emit('broadcast_performance', cachedPerformance);
  }

  // 時刻同期
  socket.on('get_time', () => {
    socket.emit('sync_time', { serverTime: Date.now() });
  });

  // 演出JSONのアップロード（管理者 App②）
  socket.on('upload_performance', (data) => {
    cachedPerformance = data;
    io.emit('broadcast_performance', data);
  });

  // 演奏開始予約（管理者 App②）
  socket.on('start_trigger', (data) => {
    io.emit('performance_start', { startTime: data.startTime });
  });

  // 切断処理
  socket.on('disconnect', () => {
    clientIndexMap.delete(socket.id);
    broadcastTotal();
  });
});

server.listen(PORT, () => {
  console.log(`Magia Relay Server listening on port ${PORT}`);
});
