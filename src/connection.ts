import nano, { ServerScope, DocumentScope, MangoQuery } from 'nano';
import * as dotenv from 'dotenv';

dotenv.config();

const couchdbUrl = process.env.COUCHDB_URL || 'http://localhost:5984';
const couch: ServerScope = nano(couchdbUrl);

let couchdbVersion: string | null = null;

export async function detectVersion(): Promise<string> {
  if (!couchdbVersion) {
    const info = await couch.info();
    couchdbVersion = info.version;
  }
  return couchdbVersion;
}

export async function isVersion3OrHigher(): Promise<boolean> {
  const version = await detectVersion();
  return parseInt(version.split('.')[0]) >= 3;
}

export async function getDatabase(dbName: string): Promise<DocumentScope<any>> {
  try {
    await couch.db.get(dbName);
  } catch (error: any) {
    if (error.statusCode === 404) {
      await couch.db.create(dbName);
    } else {
      throw error;
    }
  }
  return couch.use(dbName);
}

export async function listDatabases(): Promise<string[]> {
  return couch.db.list();
}

export async function deleteDatabase(dbName: string): Promise<void> {
  await couch.db.destroy(dbName);
}

export async function createMangoIndex(dbName: string, indexName: string, fields: string[]): Promise<any> {
  const db = await getDatabase(dbName);
  return db.createIndex({
    name: indexName,
    index: {
      fields: fields
    }
  });
}

export async function deleteMangoIndex(dbName: string, designDoc: string, indexName: string): Promise<any> {
  const db = await getDatabase(dbName);
  // Using raw HTTP request since Nano types don't fully cover Mango operations
  return await couch.request({
    db: dbName,
    method: 'delete',
    path: `_index/_design/${designDoc}/json/${indexName}`
  });
}

export async function listMangoIndexes(dbName: string): Promise<any> {
  const db = await getDatabase(dbName);
  // Using raw HTTP request since Nano types don't fully cover Mango operations
  return await couch.request({
    db: dbName,
    method: 'get',
    path: '_index'
  });
}

export async function findDocuments(dbName: string, query: MangoQuery): Promise<any> {
  const db = await getDatabase(dbName);
  return db.find(query);
}

export default couch;
