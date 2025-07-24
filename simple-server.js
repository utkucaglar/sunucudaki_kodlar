const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  if (req.url === '/api/search' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify({
          message: "YÖK Akademik API çalışıyor!",
          request: data,
          sessionId: "session_" + Date.now(),
          profiles: [{
            id: 1,
            name: data.name || "Test Akademisyen",
            institution: "Test Üniversitesi",
            email: "test@test.edu.tr"
          }]
        }));
      } catch (e) {
        res.writeHead(400);
        res.end('{"error": "Invalid JSON"}');
      }
    });
  } else {
    res.writeHead(404);
    res.end('{"error": "Not found"}');
  }
});

const PORT = 3002;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 YÖK Akademik API Server running on http://0.0.0.0:${PORT}`);
  console.log(`📡 External access: http://91.99.144.40:${PORT}`);
});
