/**
 * Network barrel (orchestrator-owned). Feature modules import the client, the
 * guards and the token helpers from here — never the mock backend directly.
 */
export * from './types';
export * from './errors';
export * from './client';
export * from './api-config';
export * from './api';
export * from './http-client';
export * from './auth-refresh';
export * from './token-storage';
export * from './guard';

export {
	MOCK_DB_SCHEMA_VERSION,
	MIGRATIONS,
	registerSeeder,
	ensureMockDb,
	readMockDb,
	getCollection,
	setCollection,
	updateCollection,
	resetMockDb,
	getMockDbStorageKey
} from './mock-backend';
export type { MockDbEnvelope, Seeder } from './mock-backend';