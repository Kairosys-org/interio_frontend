import { z } from 'zod';

/**
 * Auth form contracts (architecture §4.2).
 *
 * Messages are user-readable sentences. The password policy is enforced when
 * a password is *created* (invitation acceptance); sign-in only checks that a
 * password was entered, so an existing account is never told its password is
 * "too short" instead of "incorrect".
 */

export const emailSchema = z
	.string()
	.trim()
	.min(1, 'Enter your email address.')
	.email('Enter a valid email address.');

export const passwordSchema = z.string().min(12, 'Use at least 12 characters.');

export const loginFormSchema = z.object({
	email: emailSchema,
	password: z.string().min(1, 'Enter your password.')
});

export const mfaFormSchema = z.object({
	code: z
		.string()
		.trim()
		.regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app.')
});

export const inviteAcceptSchema = z
	.object({
		displayName: z
			.string()
			.trim()
			.min(2, 'Enter your name.')
			.max(80, 'Use 80 characters or fewer.'),
		password: passwordSchema,
		confirmPassword: z.string().min(1, 'Confirm your password.')
	})
	.refine((values) => values.password === values.confirmPassword, {
		message: 'Passwords do not match.',
		path: ['confirmPassword']
	});

export type LoginFormValues = z.infer<typeof loginFormSchema>;
export type MfaFormValues = z.infer<typeof mfaFormSchema>;
export type InviteAcceptFormValues = z.infer<typeof inviteAcceptSchema>;
