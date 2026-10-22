import type { AuditTrailRow } from '$shared/domain/audit';
import type { DedupReviewInput } from '$shared/domain/dedup';
import type { Uuid } from '$shared/domain/uuid';
import type {
	CreatePropertyInput,
	Property,
	PropertyDetail,
	PropertyListParams,
	PropertyPage,
	UpdatePropertyInput
} from '../domain/types';

export interface PropertiesRepository {
	list(params: PropertyListParams): Promise<PropertyPage>;
	get(id: Uuid): Promise<PropertyDetail>;
	create(input: CreatePropertyInput): Promise<Property>;
	update(id: Uuid, input: UpdatePropertyInput): Promise<Property>;
	archive(id: Uuid): Promise<Property>;
	unarchive(id: Uuid): Promise<Property>;
	reviewDedup(id: Uuid, input: DedupReviewInput): Promise<Property>;
	audit(id: Uuid): Promise<AuditTrailRow[]>;
}
