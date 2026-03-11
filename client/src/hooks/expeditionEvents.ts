type ExpeditionEventName =
  | "expedition_switch_success"
  | "expedition_switch_failure"
  | "expedition_create_success"
  | "expedition_create_failure"
  | "expedition_restore_success"
  | "expedition_restore_failure";

type ExpeditionEventPayload = Record<string, unknown>;

export function emitExpeditionEvent(name: ExpeditionEventName, payload: ExpeditionEventPayload = {}) {
  console.info(`[expedition_event] ${name}`, payload);
  window.dispatchEvent(new CustomEvent(name, { detail: payload }));
}
