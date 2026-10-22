import type { SessionUser } from '$shared/domain/user';
import { apiCall } from '$network/api';
import type {
	AcceptInvitationInput,
	AuthSession,
	DemoAccount,
	InvitationPreview,
	LoginInput,
	LoginResult,
	MfaVerifyInput
} from '../domain/types';
import { getAuthRepository } from './repository-provider';

const repository = getAuthRepository();

/** Mock round-trip timing; the mock backend ignores it in API mode. */
const READ = { latencyMs: 200 } as const;
const WRITE = { latencyMs: 350 } as const;

/**
 * The only surface presentation may call (architecture §4.5). Auth operations
 * are session/public flows, so no permission gate applies here: every caller
 * is either anonymous or already authenticated.
 */
export const authApi = {
	login(input: LoginInput): Promise<LoginResult> {
		return apiCall(() => repository.login(input), WRITE);
	},
	verifyMfa(input: MfaVerifyInput): Promise<AuthSession> {
		return apiCall(() => repository.verifyMfa(input), WRITE);
	},
	me(): Promise<SessionUser> {
		return apiCall(() => repository.me(), READ);
	},
	logout(): Promise<void> {
		return apiCall(() => repository.logout(), READ);
	},
	getInvitation(token: string): Promise<InvitationPreview> {
		return apiCall(() => repository.getInvitation(token), READ);
	},
	acceptInvitation(input: AcceptInvitationInput): Promise<AuthSession> {
		return apiCall(() => repository.acceptInvitation(input), WRITE);
	},
	listDemoAccounts(): Promise<DemoAccount[]> {
		return apiCall(() => repository.listDemoAccounts(), READ);
	}
};
