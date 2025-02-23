#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { 
  getDatabase, 
  listDatabases, 
  deleteDatabase, 
  isVersion3OrHigher,
  createMangoIndex,
  deleteMangoIndex,
  listMangoIndexes,
  findDocuments,
  detectVersion
} from './connection.js';

class CouchDBServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'couchdb-mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private async setupToolHandlers() {
    const version = process.env.COUCHDB_VERSION || '1.7.2';
    const isV3Plus = parseInt(version.split('.')[0]) >= 3;
    
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const baseTools = [
        {
          name: 'createDatabase',
          description: 'Create a new CouchDB database',
          inputSchema: {
            type: 'object',
            properties: {
              dbName: {
                type: 'string',
                description: 'Database name',
              },
            },
            required: ['dbName'],
          },
        },
        {
          name: 'listDatabases',
          description: 'List all CouchDB databases',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'deleteDatabase',
          description: 'Delete a CouchDB database',
          inputSchema: {
            type: 'object',
            properties: {
              dbName: {
                type: 'string',
                description: 'Database name to delete',
              },
            },
            required: ['dbName'],
          },
        },
        {
          name: 'createDocument',
          description: 'Create a new document or update an existing document in a database',
          inputSchema: {
            type: 'object',
            properties: {
              dbName: {
                type: 'string',
                description: 'Database name',
              },
              docId: {
                type: 'string',
                description: 'Document ID',
              },
              data: {
                type: 'object',
                description: 'Document data',
              },
            },
            required: ['dbName', 'docId', 'data'],
          },
        },
        {
          name: 'getDocument',
          description: 'Get a document from a database',
          inputSchema: {
            type: 'object',
            properties: {
              dbName: {
                type: 'string',
                description: 'Database name',
              },
              docId: {
                type: 'string',
                description: 'Document ID',
              },
            },
            required: ['dbName', 'docId'],
          },
        }
      ];

      const mangoTools = isV3Plus ? [
        {
          name: 'createMangoIndex',
          description: 'Create a new Mango index (CouchDB 3.x+)',
          inputSchema: {
            type: 'object',
            properties: {
              dbName: {
                type: 'string',
                description: 'Database name',
              },
              indexName: {
                type: 'string',
                description: 'Name of the index',
              },
              fields: {
                type: 'array',
                items: {
                  type: 'string'
                },
                description: 'Fields to index',
              },
            },
            required: ['dbName', 'indexName', 'fields'],
          },
        },
        {
          name: 'deleteMangoIndex',
          description: 'Delete a Mango index (CouchDB 3.x+)',
          inputSchema: {
            type: 'object',
            properties: {
              dbName: {
                type: 'string',
                description: 'Database name',
              },
              designDoc: {
                type: 'string',
                description: 'Design document name',
              },
              indexName: {
                type: 'string',
                description: 'Name of the index',
              },
            },
            required: ['dbName', 'designDoc', 'indexName'],
          },
        },
        {
          name: 'listMangoIndexes',
          description: 'List all Mango indexes in a database (CouchDB 3.x+)',
          inputSchema: {
            type: 'object',
            properties: {
              dbName: {
                type: 'string',
                description: 'Database name',
              },
            },
            required: ['dbName'],
          },
        },
        {
          name: 'findDocuments',
          description: 'Query documents using Mango query (CouchDB 3.x+)',
          inputSchema: {
            type: 'object',
            properties: {
              dbName: {
                type: 'string',
                description: 'Database name',
              },
              query: {
                type: 'object',
                description: 'Mango query object',
              },
            },
            required: ['dbName', 'query'],
          },
        }
      ] : [];

      return {
        tools: [...baseTools, ...mangoTools]
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      // Version check for Mango query tools
      if (!isV3Plus && ['createMangoIndex', 'deleteMangoIndex', 'listMangoIndexes', 'findDocuments'].includes(request.params.name)) {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Tool ${request.params.name} requires CouchDB 3.x or higher`
        );
      }

      switch (request.params.name) {
        case 'createDatabase':
          return this.handleCreateDatabase(request.params.arguments);
        case 'listDatabases':
          return this.handleListDatabases();
        case 'deleteDatabase':
          return this.handleDeleteDatabase(request.params.arguments);
        case 'createDocument':
          return this.handleCreateDocument(request.params.arguments);
        case 'getDocument':
          return this.handleGetDocument(request.params.arguments);
        case 'createMangoIndex':
          return this.handleCreateMangoIndex(request.params.arguments);
        case 'deleteMangoIndex':
          return this.handleDeleteMangoIndex(request.params.arguments);
        case 'listMangoIndexes':
          return this.handleListMangoIndexes(request.params.arguments);
        case 'findDocuments':
          return this.handleFindDocuments(request.params.arguments);
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });
  }

  private async handleCreateDatabase(args: any) {
    if (!args.dbName || typeof args.dbName !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid database name');
    }

    try {
      await getDatabase(args.dbName);
      return {
        content: [
          {
            type: 'text',
            text: `Database ${args.dbName} created successfully`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error creating database: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleListDatabases() {
    try {
      const databases = await listDatabases();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(databases, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error listing databases: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleDeleteDatabase(args: any) {
    if (!args.dbName || typeof args.dbName !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid database name');
    }

    try {
      await deleteDatabase(args.dbName);
      return {
        content: [
          {
            type: 'text',
            text: `Database ${args.dbName} deleted successfully`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error deleting database: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleCreateDocument(args: any) {
    if (!args.dbName || !args.docId || !args.data) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Missing required parameters: dbName, docId, data'
      );
    }

    try {
      const db = await getDatabase(args.dbName);
      const response = await db.insert(args.data, args.docId);
      const action = args.data._rev ? 'updated' : 'created';
      return {
        content: [
          {
            type: 'text',
            text: `Document ${action} with ID: ${response.id}, rev: ${response.rev}`,
          },
        ],
      };
    } catch (error: any) {
      const action = args.data._rev ? 'updating' : 'creating';
      return {
        content: [
          {
            type: 'text',
            text: `Error ${action} document: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleGetDocument(args: any) {
    if (!args.dbName || !args.docId) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Missing required parameters: dbName, docId'
      );
    }

    try {
      const db = await getDatabase(args.dbName);
      const doc = await db.get(args.docId);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(doc, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error retrieving document: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleCreateMangoIndex(args: any) {
    if (!args.dbName || !args.indexName || !args.fields) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Missing required parameters: dbName, indexName, fields'
      );
    }

    try {
      const result = await createMangoIndex(args.dbName, args.indexName, args.fields);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error creating Mango index: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleDeleteMangoIndex(args: any) {
    if (!args.dbName || !args.designDoc || !args.indexName) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Missing required parameters: dbName, designDoc, indexName'
      );
    }

    try {
      const result = await deleteMangoIndex(args.dbName, args.designDoc, args.indexName);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error deleting Mango index: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleListMangoIndexes(args: any) {
    if (!args.dbName) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Missing required parameter: dbName'
      );
    }

    try {
      const result = await listMangoIndexes(args.dbName);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error listing Mango indexes: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleFindDocuments(args: any) {
    if (!args.dbName || !args.query) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Missing required parameters: dbName, query'
      );
    }

    try {
      const result = await findDocuments(args.dbName, args.query);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error finding documents: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    const version = await detectVersion();
    console.error(`CouchDB MCP server running on stdio (CouchDB ${version})`);
  }
}

const server = new CouchDBServer();
server.run().catch(console.error);
