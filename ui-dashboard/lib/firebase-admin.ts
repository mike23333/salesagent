// Simple mock store for local testing (in-memory, resets on server restart)
// In production, replace with Firebase Firestore

export interface HandoffCall {
  id: string;
  room_name: string;
  phone_number: string;
  customer_name: string;
  status: 'active' | 'handoff_requested' | 'completed';
  handoff_reason?: string;
  product_name: string;
  created_at: string;
  transcript: TranscriptEntry[];
}

export interface TranscriptEntry {
  speaker: 'agent' | 'user';
  text: string;
  timestamp: string;
}

// Use global to persist across HMR and module isolation in Next.js dev mode
declare global {
  // eslint-disable-next-line no-var
  var pendingHandoffs: Map<string, HandoffCall> | undefined;
}

// In-memory store for active calls awaiting handoff
// Real handoffs are registered via POST /api/handoffs/register
const pendingHandoffs: Map<string, HandoffCall> = global.pendingHandoffs || new Map();
global.pendingHandoffs = pendingHandoffs;

export function getPendingHandoffs(): HandoffCall[] {
  return Array.from(pendingHandoffs.values()).filter(
    (call) => call.status === 'handoff_requested'
  );
}

export function getHandoffById(id: string): HandoffCall | undefined {
  return pendingHandoffs.get(id);
}

export function addHandoff(call: HandoffCall): void {
  pendingHandoffs.set(call.id, call);
}

export function updateHandoffStatus(id: string, status: HandoffCall['status']): void {
  const call = pendingHandoffs.get(id);
  if (call) {
    call.status = status;
  }
}

export function removeHandoff(id: string): void {
  pendingHandoffs.delete(id);
}
