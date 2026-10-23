<script lang="ts">
	import { CircleAlert } from '@lucide/svelte';
	import { isApiError } from '$network/errors';
	import { projectsApi } from '$modules/projects/data/api';
	import type { AssignableSurveyor } from '$modules/projects/domain/types';
	import { sessionStore } from '$shared/application/session';
	import { PERMISSIONS } from '$shared/domain/permissions';
	import { ROLES } from '$shared/domain/roles';
	import { Button, Dialog, Input, Select } from '$shared/presentation/ui';
	import { surveysApi } from '$modules/surveys/data/api';
	import type { CreateSurveyInput, Survey } from '$modules/surveys/domain/types';
	import { surveyFormSchema } from '$modules/surveys/domain/validations';
	import { fieldErrorsFrom } from '$modules/surveys/presentation/field-errors';

	/**
	 * New survey from the mobile project screen (phase-2 §3.2).
	 *
	 * The project is fixed, so only the caption, appointment and (for a
	 * production manager) the assigned surveyor are asked. A capture-only
	 * surveyor is always the surveyor, mirroring the server rule.
	 */
	interface Props {
		open?: boolean;
		projectId: string;
		projectCaption: string;
		oncreated: (survey: Survey) => void;
		onclose: () => void;
	}

	let { open = $bindable(false), projectId, projectCaption, oncreated, onclose }: Props = $props();

	const user = $derived($sessionStore.user);
	const captureOnly = $derived(
		Boolean(
			user?.roles.includes(ROLES.SURVEYOR) &&
			!user.roles.includes(ROLES.PRODUCTION_MANAGER) &&
			!user.permissions.includes(PERMISSIONS.SURVEY_APPROVE)
		)
	);

	let pool = $state<AssignableSurveyor[]>([]);
	let loadingSurveyors = $state(false);
	let surveyorError = $state<string | null>(null);
	let surveyorId = $state('');
	let caption = $state('');
	let appointmentAt = $state('');
	let errors = $state<Record<string, string>>({});
	let serverError = $state('');
	let submitting = $state(false);
	let wasOpen = false;
	let requestedFor: string | null = null;

	const options = $derived(
		pool
			.filter((surveyor) => surveyor.assigned)
			.map((surveyor) => ({
				value: surveyor.id,
				label:
					surveyor.id === user?.id
						? `${surveyor.displayName} (you)`
						: `${surveyor.displayName} · ${surveyor.email}`
			}))
	);

	$effect(() => {
		if (!open) {
			wasOpen = false;
			return;
		}
		if (!wasOpen) {
			wasOpen = true;
			reset();
		}
		if (requestedFor !== projectId) {
			requestedFor = projectId;
			void loadSurveyors();
		}
	});

	function reset(): void {
		caption = '';
		appointmentAt = '';
		surveyorId = captureOnly ? (user?.id ?? '') : '';
		errors = {};
		serverError = '';
	}

	async function loadSurveyors(): Promise<void> {
		loadingSurveyors = true;
		surveyorError = null;
		try {
			pool = await projectsApi.assignableSurveyors(projectId);
			const preferred = pool.find((row) => row.assigned && row.id === user?.id);
			if (!pool.some((row) => row.assigned && row.id === surveyorId)) {
				surveyorId = preferred?.id ?? pool.find((row) => row.assigned)?.id ?? '';
			}
		} catch (caught) {
			pool = [];
			surveyorError = isApiError(caught)
				? caught.message
				: 'We could not load the surveyors assigned to this project.';
		} finally {
			loadingSurveyors = false;
		}
	}

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		serverError = '';

		const appointment = new Date(appointmentAt);
		if (appointmentAt === '' || Number.isNaN(appointment.getTime())) {
			errors = { appointmentAt: 'Choose an appointment date and time.' };
			return;
		}

		const parsed = surveyFormSchema.safeParse({
			caption,
			surveyorId: captureOnly ? (user?.id ?? '') : surveyorId,
			appointmentAt: appointment.toISOString()
		});
		if (!parsed.success) {
			errors = fieldErrorsFrom(parsed.error);
			return;
		}
		errors = {};

		const input: CreateSurveyInput = {
			caption: parsed.data.caption,
			surveyorId: parsed.data.surveyorId,
			appointmentAt: parsed.data.appointmentAt
		};

		submitting = true;
		try {
			const created = await surveysApi.create(projectId, input);
			open = false;
			oncreated(created);
		} catch (caught) {
			if (isApiError(caught)) {
				if (caught.fieldErrors) errors = { ...caught.fieldErrors };
				serverError = caught.message;
			} else {
				serverError = 'We could not create this survey. Try again.';
			}
		} finally {
			submitting = false;
		}
	}
</script>

{#snippet footer()}
	<Button variant="secondary" onclick={onclose} disabled={submitting}>Cancel</Button>
	<Button
		variant="primary"
		type="submit"
		form="mobile-survey-form"
		loading={submitting}
		loadingLabel="Creating…"
	>
		Create survey
	</Button>
{/snippet}

<Dialog
	bind:open
	title="New survey"
	description={`Plan a visit on ${projectCaption}.`}
	{footer}
	onclose={() => {
		serverError = '';
	}}
>
	<form
		id="mobile-survey-form"
		class="flex flex-col gap-4"
		onsubmit={submit}
		novalidate
		aria-label="New survey"
	>
		<Input
			label="Survey caption"
			required
			bind:value={caption}
			maxlength={160}
			placeholder="Kitchen refurbishment — initial capture"
			error={errors.caption}
			disabled={submitting}
		/>

		<Input
			label="Appointment"
			type="datetime-local"
			required
			bind:value={appointmentAt}
			error={errors.appointmentAt}
			disabled={submitting}
		/>

		{#if captureOnly}
			<p class="text-callout text-ink">
				Surveyor: <span class="text-ink">{user?.displayName ?? 'You'}</span>
			</p>
			<p class="text-footnote text-ink-secondary">Surveys you create are assigned to you.</p>
		{:else}
			<Select
				label="Surveyor"
				required
				bind:value={surveyorId}
				{options}
				placeholder={loadingSurveyors
					? 'Loading surveyors…'
					: options.length === 0
						? 'No surveyor assigned to this project'
						: 'Choose a surveyor'}
				hint={surveyorError ?? 'Only surveyors assigned to the project can capture it.'}
				error={errors.surveyorId}
				disabled={loadingSurveyors || submitting}
			/>
		{/if}

		{#if serverError}
			<p role="alert" class="flex items-start gap-2 text-callout text-critical-ink">
				<CircleAlert size={20} strokeWidth={1.75} aria-hidden="true" class="mt-0.5 shrink-0" />
				<span>{serverError}</span>
			</p>
		{/if}
	</form>
</Dialog>
