import type { Paginated } from '$network/types';
import type { Uuid } from '$shared/domain/uuid';
import type {
	CreateTenantInput,
	PlatformAuditListParams,
	PlatformAuditRow,
	TenantDetail,
	TenantListParams,
	TenantListRow,
	TenantTransitionInput
} from '../domain/types';

export interface PlatformTenantsRepository {
	list(params: TenantListParams): Promise<Paginated<TenantListRow>>;
	get(id: Uuid): Promise<TenantDetail>;
	create(input: CreateTenantInput): Promise<TenantDetail>;
	transition(id: Uuid, input: TenantTransitionInput): Promise<TenantDetail>;
	listAudit(params: PlatformAuditListParams): Promise<Paginated<PlatformAuditRow>>;
}
