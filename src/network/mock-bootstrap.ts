/**
 * Mock bootstrap (orchestrator-owned, architecture §7).
 *
 * Imports every module seeder once so all collections are registered before
 * the first read. Imported only from client-safe entry points — never from
 * `+page.server.ts`, `+layout.server.ts`, `hooks.server.ts` or `$lib/server`.
 */
import '$modules/auth/data/mock';
import '$modules/platform-tenants/data/mock';
import '$modules/customers/data/mock';
import '$modules/properties/data/mock';
import '$modules/projects/data/mock';
import '$modules/duplicates/data/mock';
import '$modules/imports/data/mock';

export const MOCK_BOOTSTRAP_READY = true;
