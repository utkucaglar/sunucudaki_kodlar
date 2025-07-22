#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

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

    const apiUrl = 'http://localhost:3000/api/search';
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
      
      // Sonuçları analiz et ve kullanıcı dostu format yap
      if (data.collaborators) {
        // Tek profil bulundu ve işbirlikçiler otomatik olarak getirildi
        const profile = data.profiles[0];
        return {
          content: [
            {
              type: 'text',
              text: `✅ **Akademisyen Bulundu ve İşbirlikçiler Getirildi**\n\n` +
                   `📝 **Profil:** ${profile.name}\n` +
                   `🏛️ **Kurum:** ${profile.institution || 'Belirtilmemiş'}\n` +
                   `📧 **Email:** ${profile.email || 'Belirtilmemiş'}\n` +
                   `📊 **Toplam İşbirlikçi:** ${data.collaborators.length}\n\n` +
                   `🤝 **İşbirlikçiler:**\n` +
                   data.collaborators.slice(0, 10).map((collab, idx) => 
                     `${idx + 1}. **${collab.name}** - ${collab.institution || 'Kurum belirtilmemiş'}`
                   ).join('\n') +
                   (data.collaborators.length > 10 ? `\n... ve ${data.collaborators.length - 10} tane daha` : ''),
            },
          ],
          _metadata: {
            sessionId: data.sessionId,
            totalProfiles: 1,
            totalCollaborators: data.collaborators.length,
            autoCompleted: true
          }
        };
      } else if (data.profiles && data.profiles.length > 1) {
        // Birden fazla profil bulundu, kullanıcı seçimi gerekli
        return {
          content: [
            {
              type: 'text',
              text: `🔍 **${data.profiles.length} Akademisyen Profili Bulundu**\n\n` +
                   `Lütfen işbirlikçilerini bulmak istediğiniz profili seçin:\n\n` +
                   data.profiles.map((profile, idx) => 
                     `**${idx + 1}. ${profile.name}**\n` +
                     `   🏛️ Kurum: ${profile.institution || 'Belirtilmemiş'}\n` +
                     `   📧 Email: ${profile.email || 'Belirtilmemiş'}\n` +
                     `   🆔 Profile ID: ${profile.id}\n`
                   ).join('\n') +
                   `\n💡 **İşbirlikçileri bulmak için:** \`isbirlikci_bul\` tool'unu sessionId ve profileId ile çağırın.`,
            },
          ],
          _metadata: {
            sessionId: data.sessionId,
            totalProfiles: data.profiles.length,
            profiles: data.profiles,
            requiresSelection: true
          }
        };
      } else if (data.profiles && data.profiles.length === 1) {
        // Tek profil ama işbirlikçiler henüz getirilmemiş
        const profile = data.profiles[0];
        return {
          content: [
            {
              type: 'text',
              text: `✅ **Tek Akademisyen Profili Bulundu**\n\n` +
                   `📝 **Profil:** ${profile.name}\n` +
                   `🏛️ **Kurum:** ${profile.institution || 'Belirtilmemiş'}\n` +
                   `📧 **Email:** ${profile.email || 'Belirtilmemiş'}\n\n` +
                   `🔄 İşbirlikçiler bulunuyor... Lütfen \`isbirlikci_bul\` tool'unu sessionId: "${data.sessionId}" ve profileId: ${profile.id} ile çağırın.`,
            },
          ],
          _metadata: {
            sessionId: data.sessionId,
            totalProfiles: 1,
            profile: profile,
            needsCollaborators: true
          }
        };
      } else {
        throw new Error('Hiç profil bulunamadı');
      }

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

    const apiUrl = `http://localhost:3000/api/collaborators/${sessionId}`;
    const requestBody = { profileId: Number(profileId) };

    try {
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

      if (data.collaborators && data.collaborators.length > 0) {
        const profile = data.profile;
        return {
          content: [
            {
              type: 'text',
              text: `🤝 **İşbirlikçiler Bulundu**\n\n` +
                   `📝 **Seçilen Profil:** ${profile.name}\n` +
                   `🏛️ **Kurum:** ${profile.institution || 'Belirtilmemiş'}\n` +
                   `📊 **Toplam İşbirlikçi:** ${data.collaborators.length}\n\n` +
                   `🤝 **İşbirlikçiler:**\n` +
                   data.collaborators.slice(0, 15).map((collab, idx) => 
                     `${idx + 1}. **${collab.name}**\n` +
                     `   🏛️ ${collab.institution || 'Kurum belirtilmemiş'}\n` +
                     `   📧 ${collab.email || 'Email belirtilmemiş'}\n`
                   ).join('\n') +
                   (data.collaborators.length > 15 ? `\n... ve ${data.collaborators.length - 15} tane daha` : '') +
                   `\n\n✅ **Tamamlandı!** Toplam ${data.collaborators.length} işbirlikçi bulundu.`,
            },
          ],
          _metadata: {
            sessionId: data.sessionId,
            profile: data.profile,
            totalCollaborators: data.collaborators.length,
            collaborators: data.collaborators
          }
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `⚠️ **İşbirlikçi Bulunamadı**\n\n` +
                   `Seçilen profil için herhangi bir işbirlikçi bulunamadı veya işlem zaman aşımına uğradı.\n` +
                   `Session ID: ${sessionId}\n` +
                   `Profile ID: ${profileId}`,
            },
          ],
          _metadata: {
            sessionId: sessionId,
            profileId: profileId,
            totalCollaborators: 0
          }
        };
      }

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
    console.error('YÖK Akademik MCP Server başlatıldı');
  }
}

const server = new YOKAkademikServer();
server.run().catch(console.error); 