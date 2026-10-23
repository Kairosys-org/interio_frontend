<script lang="ts">
	import { CircleAlert } from '@lucide/svelte';
	import { isApiError } from '$network/errors';
	import { projectsApi } from '$modules/projects/data/api';
	import type { AssignableSurveyor, ProjectListRow } from '$modules/projects/domain/types';
	import { sessionStore } from '$shared/application/session';
	import { ROLES } from '$shared/domain/roles';
	import { Button, Dialog, Input, Select } from '$shared/presentation/ui';
	import { surveysApi } from '../../data/api';
	import type { CreateSurveyInput, Survey } from '../../domain/types';
	import { surveyFormSchema } from '../../domain/validations';
	import { fieldErrorsFrom } from '../field-errors';

	/**
	 * New survey dialog (phase-2 §3.1).
	 *
	 * A capture-only Surveyor sees only their assigned projects and cannot
	 * change the surveyor (the server enforces the same rule). A production
	 * manager picks from the project's assigned surveyors, so an unassigned
	 * name is never offered.
	 */
	interface Props {
		open?: boolean;
		onSaved: (survey: Survey) => void;
		onClose: () => void;
	}

	let { open = $bindable(false), onSaved, onClose }: Props = $props();

	const user = $derived($sessionStore.user);
	const captureOnly = $derived(
		Boolean(user?.roles.includes(ROLES.SURVEYOR) && !user.roles.includes(ROLES.PRODUCTION_MANAGER))
	);

	let projects = $state<ProjectListRow[]>([]);
	let projectsLoading = $state(false);
	let projectsError = $state<string | null>(null);
	let projectsRequested = false;

	let surveyors = $state<AssignableSurveyor[]>([]);
	let surveyorsLoading = $state(false);
	let surveyorsError = $state<string | null>(null);
	let surveyorRequest = 0;
	let loadedSurveyorsFor: string | null = null;

	let projectId = $state('');
	let caption = $state('');
	let appointmentAt = $state('');
	let surveyorId = $state('');

	let errors = $state<Record<string, string>>({});
	let serverError = $state('');
	let submitting = $state(false);

	const projectOptions = $derived(
		projects.map((project) => ({
			value: project.id,
			label: `${project.caption} · ${project.reference}`
		}))
	);

	const assignedSurveyors = $derived(surveyors.filter((surveyor) => surveyor.assigned));

	const surveyorOptions = $derived(
		assignedSurveyors.map((surveyor) => ({
			value: surveyor.id,
			label:
				surveyor.id === user?.id
					? `${surveyor.displayName} (you)`
					: `${surveyor.displayName} · ${surveyor.email}`
		}))
	);

	const surveyorHint = $derived.by(() => {
		if (captureOnly) return 'Surveys you create are assigned to you.';
		if (surveyorsLoading) return 'Loading assigned surveyors…';
		if (surveyorsError) return surveyorsError;
		if (projectId !== '' && assignedSurveyors.length === 0) {
			return 'No surveyor is assigned to this project yet. Assign one on the project page first.';
		}
		return 'Only surveyors assigned to the project can capture it.';
	});

	let wasOpen = false;

	$effect(() => {
		if (!open) {
			wasOpen = false;
			return;
		}

		if (!wasOpen) {
			resetForm();
			wasOpen = true;
		}

		if (!projectsRequested) {
			projectsRequested = true;
			void loadProjects();
		}
	});

	$effect(() => {
		if (!open) return;
		const id = projectId;
		if (id === '' || captureOnly) return;
		if (loadedSurveyorsFor === id) return;
		loadedSurveyorsFor = id;
		void loadSurveyors(id);
	});

	function resetForm(): void {
		projectId = '';
		caption = '';
		appointmentAt = '';
		surveyorId = captureOnly ? (user?.id ?? '') : '';
		surveyors = [];
		loadedSurveyorsFor = null;
		errors = {};
		serverError = '';
		submitting = false;
	}

	async function loadProjects(): Promise<void> {
		projectsLoading = true;
		projectsError = null;
		try {
			const page = await projectsApi.list({
				status: 'active',
				scope: captureOnly ? 'mine' : 'all',
				pageSize: 100,
				sort: 'updatedAt',
				sortDir: 'desc'
			});
			projects = page.items;
		} catch (caught) {
			projects = [];
			projectsError = isApiError(caught)
				? caught.message
				: 'We could not load projects. Try again.';
		} finally {
			projectsLoading = false;
		}
	}

	async function loadSurveyors(id: string): Promise<void> {
		const sequence = ++surveyorRequest;
		surveyorsLoading = true;
		surveyorsError = null;
		try {
			const pool = await projectsApi.assignableSurveyors(id);
			if (sequence !== surveyorRequest) return;
			surveyors = pool;
			if (!pool.some((surveyor) => surveyor.id === surveyorId && surveyor.assigned)) {
				const preferred = pool.find((surveyor) => surveyor.assigned && surveyor.id === user?.id);
				surveyorId = preferred?.id ?? pool.find((surveyor) => surveyor.assigned)?.id ?? '';
			}
		} catch (caught) {
			if (sequence !== surveyorRequest) return;
			surveyors = [];
			surveyorsError = isApiError(caught)
				? caught.message
				: 'We could not load the surveyors assigned to this project.';
		} finally {
			if (sequence === surveyorRequest) surveyorsLoading = false;
		}
	}

	function close(): void {
		if (submitting) return;
		serverError = '';
		onClose();
	}

	function clearError(key: string): void {
		if (!(key in errors)) return;
		const next = { ...errors };
		delete next[key];
		errors = next;
	}

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		serverError = '';

		if (projectId === '') {
			errors = { projectId: 'Choose a project.' };
			return;
		}

		const appointment = new Date(appointmentAt);
		if (appointmentAt === '' || Number.isNaN(appointment.getTime())) {
			errors = { appointmentAt: 'Choose an appointment date and time.' };
			return;
		}

		const resolvedSurveyorId = captureOnly ? (user?.id ?? '') : surveyorId;
		const parsed = surveyFormSchema.safeParse({
			caption,
			surveyorId: resolvedSurveyorId,
			appointmentAt: appointment.toISOString()
		});
		if (!parsed.success) {
			errors = fieldErrorsFrom(parsed.error);
			return;
		}
		errors = {};

		const values = parsed.data;
		const input: CreateSurveyInput = {
			caption: values.caption,
			surveyorId: values.surveyorId,
			appointmentAt: values.appointmentAt
		};

		submitting = true;
		try {
			const saved = await surveysApi.create(projectId, input);
			open = false;
			onSaved(saved);
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
	<Button variant="secondary" onclick={close} disabled={submitting}>Cancel</Button>
	<Button
		variant="primary"
		type="submit"
		form="survey-form"
		loading={submitting}
		loadingLabel="Creating…"
	>
		Create survey
	</Button>
{/snippet}

<Dialog
	bind:open
	title="New survey"
	description="Plan a visit to one of your active projects. The survey starts as a draft."
	{footer}
	onclose={() => {
		serverError = '';
	}}
>
	<form
		id="survey-form"
		class="flex flex-col gap-4"
		onsubmit={submit}
		novalidate
		aria-label="New survey"
	>
		<Select
			label="Project"
			required
			bind:value={projectId}
			options={projectOptions}
			placeholder={projectsLoading ? 'Loading projects…' : 'Choose a project'}
			hint={projectsError ?? (captureOnly ? 'Only projects you are assigned to.' : undefined)}
			error={errors.projectId}
			disabled={projectsLoading || submitting}
			onchange={() => clearError('projectId')}
		/>

		<Input
			label="Survey caption"
			required
			bind:value={caption}
			maxlength={160}
			placeholder="Kitchen refurbishment — initial capture"
			hint="A short name the team recognises in lists."
			error={errors.caption}
			disabled={submitting}
		/>

		<Input
			label="Appointment"
			type="datetime-local"
			required
			bind:value={appointmentAt}
			hint="When the surveyor visits the property."
			error={errors.appointmentAt}
			disabled={submitting}
		/>

		{#if captureOnly}
			<div class="flex flex-col gap-1">
				<p class="text-subheadline text-ink">Surveyor</p>
				<p class="text-callout text-ink">{user?.displayName ?? 'You'}</p>
				<p class="text-footnote text-ink-secondary">{surveyorHint}</p>
			</div>
		{:else}
			<Select
				label="Surveyor"
				required
				bind:value={surveyorId}
				options={surveyorOptions}
				placeholder={surveyorsLoading ? 'Loading surveyors…' : 'Choose a surveyor'}
				hint={surveyorHint}
				error={errors.surveyorId}
				disabled={surveyorsLoading || submitting || projectId === ''}
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
