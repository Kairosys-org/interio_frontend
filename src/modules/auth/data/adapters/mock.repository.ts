import type { AuthRepository } from '../repository';
import {
	mockAcceptInvitation,
	mockGetInvitation,
	mockListDemoAccounts,
	mockLogin,
	mockLogout,
	mockMe,
	mockVerifyMfa
} from '../mock';

/** Thin and boring: one line per method, no logic (architecture §4.7). */
export const mockAuthRepository: AuthRepository = {
	login: async (input) => mockLogin(input),
	verifyMfa: async (input) => mockVerifyMfa(input),
	me: async () => mockMe(),
	logout: async () => mockLogout(),
	getInvitation: async (token) => mockGetInvitation(token),
	acceptInvitation: async (input) => mockAcceptInvitation(input),
	listDemoAccounts: async () => mockListDemoAccounts()
};
