import type { SessionUser } from '$shared/domain/user';
import type {
	AcceptInvitationInput,
	AuthSession,
	DemoAccount,
	InvitationPreview,
	LoginInput,
	LoginResult,
	MfaVerifyInput
} from '../domain/types';

export interface AuthRepository {
	login(input: LoginInput): Promise<LoginResult>;
	verifyMfa(input: MfaVerifyInput): Promise<AuthSession>;
	me(): Promise<SessionUser>;
	logout(): Promise<void>;
	getInvitation(token: string): Promise<InvitationPreview>;
	acceptInvitation(input: AcceptInvitationInput): Promise<AuthSession>;
	/** Mock-only affordance; the API adapter returns an empty list. */
	listDemoAccounts(): Promise<DemoAccount[]>;
}
