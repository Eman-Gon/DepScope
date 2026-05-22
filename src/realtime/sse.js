const sseClients = {};

function attachSSEClient(analysisId, req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write('\n');

  if (!sseClients[analysisId]) sseClients[analysisId] = [];
  sseClients[analysisId].push(res);

  req.on('close', () => {
    sseClients[analysisId] = (sseClients[analysisId] || []).filter(client => client !== res);
  });
}

function broadcastSSE(analysisId, data) {
  const clients = sseClients[analysisId] || [];
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  clients.forEach(res => res.write(payload));
}

function closeSSE(analysisId) {
  const clients = sseClients[analysisId] || [];
  clients.forEach(res => res.end());
  delete sseClients[analysisId];
}

module.exports = {
  attachSSEClient,
  broadcastSSE,
  closeSSE,
};
