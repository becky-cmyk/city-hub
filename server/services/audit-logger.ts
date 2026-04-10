import { db } from "../db";
import { auditLog } from "@shared/schema";

export const AuditActions = {
  LICENSE_CREATED: "LICENSE_CREATED",
  LICENSE_SUSPENDED: "LICENSE_SUSPENDED",
  LICENSE_REVOKED: "LICENSE_REVOKED",
  LICENSE_REACTIVATED: "LICENSE_REACTIVATED",
  SCOPE_CHANGED: "SCOPE_CHANGED",
  ENTITY_ASSIGNED: "ENTITY_ASSIGNED",
  ENTITY_UNASSIGNED: "ENTITY_UNASSIGNED",
  PAYOUT_APPROVED: "PAYOUT_APPROVED",
  PAYOUT_PAID: "PAYOUT_PAID",
  CHECKOUT_INITIATED: "CHECKOUT_INITIATED",
  CHECKOUT_COMPLETED: "CHECKOUT_COMPLETED",
  OPERATOR_INVITED: "OPERATOR_INVITED",
  OPERATOR_REVOKED: "OPERATOR_REVOKED",
  SOURCE_PULL_TRIGGERED: "SOURCE_PULL_TRIGGERED",
  KILL_SWITCH_BLOCKED: "KILL_SWITCH_BLOCKED",
  PAYOUT_GENERATED: "PAYOUT_GENERATED",
  REVENUE_SPLIT_CREATED: "REVENUE_SPLIT_CREATED",
  TERRITORY_ASSIGNED: "TERRITORY_ASSIGNED",
  TERRITORY_UNASSIGNED: "TERRITORY_UNASSIGNED",
} as const;

export type AuditAction = typeof AuditActions[keyof typeof AuditActions];

interface LogAuditParams {
  actorUserId?: string;
  actorOperatorId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  operatorId?: string;
  metadata?: Record<string, any>;
}

export function logAudit(params: LogAuditParams): void {
  db.insert(auditLog).values({
    actorUserId: params.actorUserId || null,
    actorOperatorId: params.actorOperatorId || null,
    action: params.action,
    entityType: params.entityType || null,
    entityId: params.entityId || null,
    operatorId: params.operatorId || null,
    metadataJson: params.metadata || null,
  }).execute().catch((err) => {
    console.error("[AUDIT_LOG] Failed to write audit log:", err);
  });
}
