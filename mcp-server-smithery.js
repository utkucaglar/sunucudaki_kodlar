import express from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

const app = express();
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'YÖK Akademik MCP Server', 
    status: 'running' 
  });
});

// Tools list endpoint
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

// Search researcher endpoint
app.post('/search_researcher', async (req, res) => {
  try {
    const { name, email, field_id, specialty_ids } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name parameter is required' });
    }

    // Mock response for now
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
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get collaborators endpoint
app.post('/get_collaborators', async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name parameter is required' });
    }

    // Mock response for now
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
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 8000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`MCP Server running on port ${PORT}`);
});

export default app;
