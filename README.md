# couchdb-mcp-server

A Model Context Protocol server for interacting with CouchDB

This is a TypeScript-based MCP server that provides tools for managing CouchDB databases and documents. It enables AI assistants to interact with CouchDB through a simple interface.

## Features

### Tools

#### Base Tools (All CouchDB Versions)
- `createDatabase` - Create a new CouchDB database
  - Takes `dbName` as a required parameter
  - Creates the database if it doesn't exist
  
- `listDatabases` - List all CouchDB databases
  - Returns an array of database names
  
- `deleteDatabase` - Delete a CouchDB database
  - Takes `dbName` as a required parameter
  - Removes the specified database and all its documents
  
- `createDocument` - Create a new document or update an existing document in a database
  - Required parameters:
    - `dbName`: Database name
    - `docId`: Document ID
    - `data`: Document data (JSON object)
      - For updates, include `_rev` field with the current document revision
  - Returns:
    - For new documents: document ID and new revision
    - For updates: document ID and updated revision
  - Automatically detects if operation is create or update based on presence of `_rev` field
  
- `getDocument` - Get a document from a database
  - Required parameters:
    - `dbName`: Database name
    - `docId`: Document ID
  - Returns the document content

#### Mango Query Tools (CouchDB 3.x+ Only)
- `createMangoIndex` - Create a new Mango index
  - Required parameters:
    - `dbName`: Database name
    - `indexName`: Name of the index
    - `fields`: Array of field names to index
  - Creates a new index for efficient querying

- `deleteMangoIndex` - Delete a Mango index
  - Required parameters:
    - `dbName`: Database name
    - `designDoc`: Design document name
    - `indexName`: Name of the index
  - Removes an existing Mango index

- `listMangoIndexes` - List all Mango indexes in a database
  - Required parameters:
    - `dbName`: Database name
  - Returns information about all indexes in the database

- `findDocuments` - Query documents using Mango query
  - Required parameters:
    - `dbName`: Database name
    - `query`: Mango query object
  - Performs a query using CouchDB's Mango query syntax

## Version Support

The server automatically detects the CouchDB version and enables features accordingly:
- All versions: Basic database and document operations
- CouchDB 3.x+: Mango query support (indexes and queries)

## Configuration

The server requires a CouchDB connection URL. This can be provided through environment variables:

```bash
COUCHDB_URL=http://username:password@localhost:5984
```

You can create a `.env` file in the project root with this configuration. If not provided, it defaults to `http://localhost:5984`.

## Development

Install dependencies:
```bash
npm install
```

Build the server:
```bash
npm run build
```

For development with auto-rebuild:
```bash
npm run watch
```

## Installation

To use with Claude Desktop, add the server config:

On MacOS: `~/Library/Application Support/Claude/claude_desktop_config.json`  
On Windows: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "couchdb-mcp-server": {
      "command": "/path/to/couchdb-mcp-server/build/index.js",
      "env": {
        "COUCHDB_URL": "http://username:password@localhost:5984"
      }
    }
  }
}
```

### Prerequisites

- Node.js 14 or higher
- Running CouchDB instance
- Proper CouchDB credentials if authentication is enabled

### Debugging

Since MCP servers communicate over stdio, debugging can be challenging. We recommend using the [MCP Inspector](https://github.com/modelcontextprotocol/inspector), which is available as a package script:

```bash
npm run inspector
```

The Inspector will provide a URL to access debugging tools in your browser.

## Error Handling

The server includes robust error handling for common scenarios:
- Invalid database names or document IDs
- Database already exists/doesn't exist
- Connection issues
- Authentication failures
- Invalid document data

All errors are properly formatted and returned through the MCP protocol with appropriate error codes and messages.
