import express from 'express';

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

app.get('/', (req, res) => {
  res.json({ 
    message: 'YÖK Akademik MCP Server', 
    status: 'running' 
  });
});

app.get('/tools', (req, res) => {
  res.json({
    tools: [
      {
        name: 'search_researcher',
        description: 'Search for researchers in YÖK Akademik',
        endpoint: '/search_researcher'
      },
      {
        name: 'get_collaborators', 
        description: 'Get collaborators for a researcher',
        endpoint: '/get_collaborators'
      }
    ]
  });
});

app.post('/search_researcher', (req, res) => {
  const { name } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Name parameter is required' });
  }

  res.json({
    results: [
      {
        name: name,
        title: 'Test Professor',
        url: 'https://example.com',
        info: 'Test information',
        photoUrl: '/default_photo.jpg',
        header: 'Test Header',
        email: 'test@example.com'
      }
    ]
  });
});

app.post('/get_collaborators', (req, res) => {
  const { name } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Name parameter is required' });
  }

  res.json({
    collaborators: [
      {
        id: 1,
        name: 'Collaborator 1',
        url: 'https://example.com/collab1'
      },
      {
        id: 2,
        name: 'Collaborator 2',
        url: 'https://example.com/collab2'
      }
    ]
  });
});

const PORT = process.env.PORT || 8000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`MCP Server running on port ${PORT}`);
});
