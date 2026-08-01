import type { CommunicationLog } from "@/data/types";

const DUPLICATE_WINDOW_MS = 5_000;

function normalizedRecipient(log: CommunicationLog): string {
  const value = String(log.recipient || "").trim().toLowerCase();
  if (log.channel === "email") return value;
  return value.replace(/\D/g, "").replace(/^00/, "");
}

export function communicationLogEventKey(log: CommunicationLog): string {
  return [
    log.channel,
    log.provider,
    normalizedRecipient(log),
    log.paymentId || "",
    log.contractId || "",
    log.templateKind,
    log.dedupeKey || "",
  ].join("|");
}

function eventTime(log: CommunicationLog): number {
  const value = new Date(log.createdAt).getTime();
  return Number.isFinite(value) ? value : 0;
}

export function areDuplicateCommunicationLogs(a: CommunicationLog, b: CommunicationLog): boolean {
  return communicationLogEventKey(a) === communicationLogEventKey(b)
    && Math.abs(eventTime(a) - eventTime(b)) <= DUPLICATE_WINDOW_MS;
}

function shouldReplace(existing: CommunicationLog, candidate: CommunicationLog): boolean {
  const existingWasEdited = /المستخدم|user/i.test(existing.error || "");
  const candidateWasEdited = /المستخدم|user/i.test(candidate.error || "");
  if (candidateWasEdited !== existingWasEdited) return candidateWasEdited;
  if (candidate.error && !existing.error) return true;
  return eventTime(candidate) >= eventTime(existing);
}

/**
 * Removes copies of the same send attempt while preserving genuine retries
 * performed later. A five-second window is deliberately narrow so a manual
 * retry remains a separate audit record.
 */
export function deduplicateCommunicationLogs(logs: CommunicationLog[]): CommunicationLog[] {
  const result: CommunicationLog[] = [];
  for (const log of logs) {
    const duplicateIndex = result.findIndex((item) => areDuplicateCommunicationLogs(item, log));
    if (duplicateIndex < 0) {
      result.push(log);
    } else if (shouldReplace(result[duplicateIndex], log)) {
      result[duplicateIndex] = log;
    }
  }
  return result;
}

export function expandCommunicationLogSelection(
  allLogs: CommunicationLog[],
  selectedLogs: CommunicationLog[],
): CommunicationLog[] {
  const selectedIds = new Set(selectedLogs.map((log) => log.id));
  return allLogs.filter((log) =>
    selectedIds.has(log.id)
    || selectedLogs.some((selected) => areDuplicateCommunicationLogs(log, selected))
  );
}

export function mergeCommunicationLogs(
  existing: CommunicationLog[],
  incoming: CommunicationLog[],
  limit = 2_000,
): CommunicationLog[] {
  return deduplicateCommunicationLogs([...existing, ...incoming]).slice(-limit);
}
