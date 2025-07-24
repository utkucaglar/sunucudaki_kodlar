#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} = require('@modelcontextprotocol/sdk/types.js');

class YOKAkademikServer {
  constructor() {
    this.server = new Server(
      {
        name: 'yok-akademik-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.apiBaseUrl = 'http://91.99.144.40:3002';
    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  setupErrorHandling() {
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'akademisyen_ara',
          description: 'YÖK akademik sisteminde akademisyen arar. İsim zorunlu, email, alan ve uzmanlık opsiyonel.',
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Akademisyenin adı soyadı (zorunlu)',
              },
              email: {
                type: 'string',
                description: 'Email adresi (opsiyonel)',
              },
              fieldId: {
                type: 'number',
                description: 'Alan ID (opsiyonel)',
              },
              specialtyIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Uzmanlık ID\'leri veya ["all"] (opsiyonel)',
              },
            },
            required: ['name'],
          },
        },
        {
          name: 'isbirlikci_bul',
          description: 'Seçilen akademisyen profiline göre işbirlikçilerini bulur.',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: {
                type: 'string',
                description: 'Arama session ID (akademisyen_ara çağrısından dönen)',
              },
              profileId: {
                type: 'number',
                description: 'Seçilen profilin ID\'si',
              },
            },
            required: ['sessionId', 'profileId'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        if (name === 'akademisyen_ara') {
          return await this.akademisyenAra(args);
        } else if (name === 'isbirlikci_bul') {
          return await this.isbirlikciBul(args);
        } else {
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Bilinmeyen tool: ${name}`
          );
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Tool çalıştırılırken hata: ${error.message}`
        );
      }
    });
  }

  async akademisyenAra(args) {
    const { name, email, fieldId, specialtyIds } = args;

    if (!name || !name.trim()) {
      throw new McpError(ErrorCode.InvalidParams, 'İsim gereklidir');
    }

    const apiUrl = `${this.apiBaseUrl}/api/search`;
    const requestBody = { name: name.trim() };

    if (email && email.trim()) {
      requestBody.email = email.trim();
    }
    if (fieldId) {
      requestBody.fieldId = fieldId;
    }
    if (specialtyIds && Array.isArray(specialtyIds)) {
      requestBody.specialtyIds = specialtyIds;
    }

    try {
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'API hatası' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      
      return {
        content: [
          {
            type: 'text',
            text: `✅ **Akademisyen Arama Sonucu**\n\n` +
                 `🔍 **Aranan:** ${name}\n` +
                 `📊 **Bulunan Profil:** ${data.profiles?.length || 0}\n` +
                 `🆔 **Session ID:** ${data.sessionId}\n\n` +
                 `📝 **Profil Detayları:**\n` +
                 (data.profiles || []).map((profile, idx) => 
                   `${idx + 1}. **${profile.name}**\n` +
                   `   🏛️ Kurum: ${profile.institution || 'Belirtilmemiş'}\n` +
                   `   📧 Email: ${profile.email || 'Belirtilmemiş'}\n` +
                   `   🆔 ID: ${profile.id}\n`
                 ).join('\n') +
                 `\n💡 **İşbirlikçiler için:** \`isbirlikci_bul\` tool'unu sessionId ve profileId ile çağırın.`,
          },
        ],
        _metadata: {
          sessionId: data.sessionId,
          totalProfiles: data.profiles?.length || 0,
          profiles: data.profiles,
          apiResponse: data
        }
      };

    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `API çağrısı başarısız: ${error.message}`
      );
    }
  }

  async isbirlikciBul(args) {
    const { sessionId, profileId } = args;

    if (!sessionId || !profileId) {
      throw new McpError(ErrorCode.InvalidParams, 'sessionId ve profileId gereklidir');
    }

    const apiUrl = `${this.apiBaseUrl}/api/collaborators/${sessionId}`;
    const requestBody = { profileId: Number(profileId) };

    try {
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'API hatası' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();

      return {
        content: [
          {
            type: 'text',
            text: `🤝 **İşbirlikçiler Bulundu**\n\n` +
                 `📝 **Seçilen Profil:** ${data.profile?.name || 'Bilinmiyor'}\n` +
                 `🏛️ **Kurum:** ${data.profile?.institution || 'Belirtilmemiş'}\n` +
                 `📊 **Toplam İşbirlikçi:** ${data.collaborators?.length || 0}\n\n` +
                 `🤝 **İşbirlikçiler:**\n` +
                 (data.collaborators || []).slice(0, 15).map((collab, idx) => 
                   `${idx + 1}. **${collab.name}**\n` +
                   `   🏛️ ${collab.institution || 'Kurum belirtilmemiş'}\n` +
                   `   📧 ${collab.email || 'Email belirtilmemiş'}\n`
                 ).join('\n') +
                 (data.collaborators?.length > 15 ? `\n... ve ${data.collaborators.length - 15} tane daha` : '') +
                 `\n\n✅ **Tamamlandı!**`,
          },
        ],
        _metadata: {
          sessionId: sessionId,
          profile: data.profile,
          totalCollaborators: data.collaborators?.length || 0,
          collaborators: data.collaborators
        }
      };

    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `İşbirlikçi bulma API çağrısı başarısız: ${error.message}`
      );
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('YÖK Akademik MCP Server başlatıldı (Public API: http://91.99.144.40:3002)');
  }
}

const server = new YOKAkademikServer();
server.run().catch(console.error);
