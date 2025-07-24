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
          sessionId: "session_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9),
          profiles: [{
            id: 1,
            name: data.name || "Test Akademisyen",
            institution: "Test Üniversitesi",
            email: "test@test.edu.tr",
            url: "https://akademik.yok.gov.tr/test"
          }]
        }));
      } catch (e) {
        res.writeHead(400);
        res.end('{"error": "Invalid JSON"}');
      }
    });
  } else if (req.url.startsWith('/api/collaborators/') && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify({
          sessionId: req.url.split('/')[3],
          profile: {
            id: data.profileId,
            name: "Seçilen Akademisyen",
            institution: "Seçilen Üniversite"
          },
          collaborators: [
            {
              name: "Dr. Test İşbirlikçi 1",
              institution: "Test Üniversitesi 1",
              email: "test1@test.edu.tr"
            },
            {
              name: "Prof. Dr. Test İşbirlikçi 2", 
              institution: "Test Üniversitesi 2",
              email: "test2@test.edu.tr"
            }
          ]
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
  console.log(`🔍 Test with: curl -X POST http://91.99.144.40:${PORT}/api/search -H "Content-Type: application/json" -d '{"name": "test"}'`);
});
