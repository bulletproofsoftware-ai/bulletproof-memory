/**
 * REQ-EVO-031: Time-Travel Debugging
 *
 * Records all external inputs during agent sessions, enables deterministic replay
 * with frozen world state, and allows step-back modification for what-if analysis.
 *
 * Storage: Qdrant collection `session_recordings` with semantic embeddings for
 * searching session content by natural language.
 */

import { createHash, randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RecordedToolCall {
  tool_name: string;
  parameters: Record<string, unknown>;
  parameters_hash: string;
  response: unknown;
  response_hash: string;
  timestamp: string;
  sequence_number: number;
  session_id: string;
  recording_id: string;
}

export interface SessionRecording {
  recording_id: string;
  session_id: string;
  started_at: string;
  ended_at: string | null;
  tool_call_count: number;
  status: "recording" | "completed" | "replaying";
  description: string;
}

export interface ReplayState {
  replay_id: string;
  recording_id: string;
  current_step: number;
  total_steps: number;
  divergences: Divergence[];
  modifications: StepModification[];
  status: "paused" | "running" | "completed";
  started_at: string;
  completed_at: string | null;
}

export interface Divergence {
  step_number: number;
  type: "parameter_mismatch" | "response_mismatch" | "tool_mismatch" | "path_divergence";
  original: { tool_name: string; parameters_hash: string; response_hash: string };
  replayed: { tool_name: string; parameters_hash: string; response_hash: string };
  description: string;
}

export interface StepModification {
  step_number: number;
  modification_type: "response_override" | "parameter_override" | "skip" | "inject";
  original_value: unknown;
  modified_value: unknown;
  applied_at: string;
}

export interface ExecutionComparison {
  original_id: string;
  modified_id: string;
  original_steps: number;
  modified_steps: number;
  divergence_point: number | null;
  divergences: Divergence[];
  summary: string;
}

export interface TimelineEntry {
  step: number;
  tool_name: string;
  timestamp: string;
  duration_ms: number | null;
  parameters_hash: string;
  response_hash: string;
  has_modification: boolean;
}

// Dependencies injected from index.ts
export interface TimeTravelDeps {
  storePoint: (collection: string, id: string, vector: number[], payload: Record<string, unknown>) => Promise<void>;
  scrollPoints: (collection: string, filter?: Record<string, unknown>, limit?: number) => Promise<unknown[]>;
  generateEmbedding: (text: string) => Promise<number[] | null>;
  generateUUID: () => string;
  deletePoints?: (collection: string, ids: string[]) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLLECTION = "session_recordings";

export const TIME_TRAVEL_COLLECTIONS = {
  SESSION_RECORDINGS: COLLECTION,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hashValue(value: unknown): string {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  return createHash("sha256").update(serialized).digest("hex");
}

function sanitizeParams(params: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes("password") ||
      lowerKey.includes("secret") ||
      lowerKey.includes("token") ||
      lowerKey.includes("api_key") ||
      lowerKey.includes("apikey") ||
      lowerKey.includes("credential")
    ) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "string" && value.length > 10000) {
      sanitized[key] = value.slice(0, 10000) + "...[truncated]";
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

// ---------------------------------------------------------------------------
// TimeTravelDebugger
// ---------------------------------------------------------------------------

export class TimeTravelDebugger {
  private deps: TimeTravelDeps;
  // In-memory state for active recordings and replays
  private activeRecordings: Map<string, SessionRecording> = new Map();
  private recordingCalls: Map<string, RecordedToolCall[]> = new Map();
  private activeReplays: Map<string, ReplayState> = new Map();

  private static readonly MAX_CACHE_SIZE = 100;

  constructor(deps: TimeTravelDeps) {
    this.deps = deps;
  }

  /**
   * Evict the oldest entry from a Map when it exceeds MAX_CACHE_SIZE.
   * Maps iterate in insertion order, so the first key is the oldest.
   */
  private evictOldest<V>(map: Map<string, V>): void {
    if (map.size > TimeTravelDebugger.MAX_CACHE_SIZE) {
      const oldest = map.keys().next().value;
      if (oldest !== undefined) {
        map.delete(oldest);
      }
    }
  }

  /**
   * Begin capturing tool calls for a session.
   */
  async startRecording(sessionId: string, description?: string): Promise<SessionRecording> {
    // Check if there's already an active recording for this session
    for (const rec of this.activeRecordings.values()) {
      if (rec.session_id === sessionId && rec.status === "recording") {
        throw new Error(`Session ${sessionId} already has an active recording: ${rec.recording_id}`);
      }
    }

    const recordingId = randomUUID();
    const now = new Date().toISOString();

    const recording: SessionRecording = {
      recording_id: recordingId,
      session_id: sessionId,
      started_at: now,
      ended_at: null,
      tool_call_count: 0,
      status: "recording",
      description: description || `Recording of session ${sessionId}`,
    };

    this.activeRecordings.set(recordingId, recording);
    this.evictOldest(this.activeRecordings);
    this.recordingCalls.set(recordingId, []);
    this.evictOldest(this.recordingCalls);

    // Store recording metadata in Qdrant
    const embeddingText = `session recording ${sessionId} ${description || ""}`;
    const embedding = await this.deps.generateEmbedding(embeddingText);
    if (embedding) {
      await this.deps.storePoint(COLLECTION, recordingId, embedding, {
        point_type: "recording_metadata",
        ...recording,
      });
    }

    return recording;
  }

  /**
   * Capture a single tool call within an active recording.
   */
  async recordToolCall(
    recordingId: string,
    toolName: string,
    params: Record<string, unknown>,
    response: unknown
  ): Promise<RecordedToolCall> {
    const recording = this.activeRecordings.get(recordingId);
    if (!recording) {
      throw new Error(`No active recording found: ${recordingId}`);
    }
    if (recording.status !== "recording") {
      throw new Error(`Recording ${recordingId} is not in recording state (status: ${recording.status})`);
    }

    const calls = this.recordingCalls.get(recordingId)!;
    const sequenceNumber = calls.length + 1;
    const sanitizedParams = sanitizeParams(params);
    const now = new Date().toISOString();

    // Truncate response for storage if it's very large
    let storedResponse = response;
    const responseStr = JSON.stringify(response);
    if (responseStr.length > 50000) {
      storedResponse = {
        _truncated: true,
        _original_size: responseStr.length,
        _preview: responseStr.slice(0, 5000),
        _hash: hashValue(response),
      };
    }

    const toolCall: RecordedToolCall = {
      tool_name: toolName,
      parameters: sanitizedParams,
      parameters_hash: hashValue(sanitizedParams),
      response: storedResponse,
      response_hash: hashValue(response),
      timestamp: now,
      sequence_number: sequenceNumber,
      session_id: recording.session_id,
      recording_id: recordingId,
    };

    calls.push(toolCall);
    recording.tool_call_count = calls.length;

    // Store tool call in Qdrant with embedding
    const callId = this.deps.generateUUID();
    const embeddingText = `tool call ${toolName} ${JSON.stringify(sanitizedParams).slice(0, 500)}`;
    const embedding = await this.deps.generateEmbedding(embeddingText);
    if (embedding) {
      await this.deps.storePoint(COLLECTION, callId, embedding, {
        point_type: "tool_call",
        ...toolCall,
        response: storedResponse,
      });
    }

    return toolCall;
  }

  /**
   * Finalize a recording.
   */
  async stopRecording(recordingId: string): Promise<SessionRecording> {
    const recording = this.activeRecordings.get(recordingId);
    if (!recording) {
      throw new Error(`No active recording found: ${recordingId}`);
    }
    if (recording.status !== "recording") {
      throw new Error(`Recording ${recordingId} is not in recording state`);
    }

    recording.status = "completed";
    recording.ended_at = new Date().toISOString();

    // Update metadata in Qdrant
    const embeddingText = `completed session recording ${recording.session_id} ${recording.description} ${recording.tool_call_count} tool calls`;
    const embedding = await this.deps.generateEmbedding(embeddingText);
    if (embedding) {
      await this.deps.storePoint(COLLECTION, recordingId, embedding, {
        point_type: "recording_metadata",
        ...recording,
      });
    }

    return recording;
  }

  /**
   * List available session recordings. Loads from Qdrant if not in memory.
   */
  async listRecordings(limit: number = 20): Promise<SessionRecording[]> {
    const points = await this.deps.scrollPoints(
      COLLECTION,
      {
        must: [
          { key: "point_type", match: { value: "recording_metadata" } },
        ],
      },
      limit
    );

    const recordings: SessionRecording[] = [];
    for (const point of points) {
      const p = point as { payload?: Record<string, unknown> };
      if (p.payload) {
        recordings.push({
          recording_id: (p.payload.recording_id as string) || "",
          session_id: (p.payload.session_id as string) || "",
          started_at: (p.payload.started_at as string) || "",
          ended_at: (p.payload.ended_at as string | null) || null,
          tool_call_count: (p.payload.tool_call_count as number) || 0,
          status: (p.payload.status as SessionRecording["status"]) || "completed",
          description: (p.payload.description as string) || "",
        });
      }
    }

    // Sort by started_at descending
    recordings.sort((a, b) => b.started_at.localeCompare(a.started_at));
    return recordings;
  }

  /**
   * Get recording details + full timeline of tool calls.
   */
  async getRecording(recordingId: string): Promise<{
    recording: SessionRecording;
    tool_calls: RecordedToolCall[];
  }> {
    // Check in-memory first
    const inMemory = this.activeRecordings.get(recordingId);
    const inMemoryCalls = this.recordingCalls.get(recordingId);

    if (inMemory && inMemoryCalls) {
      return { recording: inMemory, tool_calls: inMemoryCalls };
    }

    // Load from Qdrant
    const metaPoints = await this.deps.scrollPoints(
      COLLECTION,
      {
        must: [
          { key: "point_type", match: { value: "recording_metadata" } },
          { key: "recording_id", match: { value: recordingId } },
        ],
      },
      1
    );

    if (metaPoints.length === 0) {
      throw new Error(`Recording not found: ${recordingId}`);
    }

    const meta = metaPoints[0] as { payload?: Record<string, unknown> };
    const recording: SessionRecording = {
      recording_id: (meta.payload?.recording_id as string) || recordingId,
      session_id: (meta.payload?.session_id as string) || "",
      started_at: (meta.payload?.started_at as string) || "",
      ended_at: (meta.payload?.ended_at as string | null) || null,
      tool_call_count: (meta.payload?.tool_call_count as number) || 0,
      status: (meta.payload?.status as SessionRecording["status"]) || "completed",
      description: (meta.payload?.description as string) || "",
    };

    // Load tool calls
    const callPoints = await this.deps.scrollPoints(
      COLLECTION,
      {
        must: [
          { key: "point_type", match: { value: "tool_call" } },
          { key: "recording_id", match: { value: recordingId } },
        ],
      },
      1000
    );

    const toolCalls: RecordedToolCall[] = callPoints
      .map((cp) => {
        const c = cp as { payload?: Record<string, unknown> };
        if (!c.payload) return null;
        return {
          tool_name: (c.payload.tool_name as string) || "",
          parameters: (c.payload.parameters as Record<string, unknown>) || {},
          parameters_hash: (c.payload.parameters_hash as string) || "",
          response: c.payload.response,
          response_hash: (c.payload.response_hash as string) || "",
          timestamp: (c.payload.timestamp as string) || "",
          sequence_number: (c.payload.sequence_number as number) || 0,
          session_id: (c.payload.session_id as string) || "",
          recording_id: (c.payload.recording_id as string) || recordingId,
        } as RecordedToolCall;
      })
      .filter((tc): tc is RecordedToolCall => tc !== null)
      .sort((a, b) => a.sequence_number - b.sequence_number);

    // Cache in memory
    this.activeRecordings.set(recordingId, recording);
    this.recordingCalls.set(recordingId, toolCalls);

    return { recording, tool_calls: toolCalls };
  }

  /**
   * Initialize replay state for a recording.
   */
  async startReplay(recordingId: string): Promise<ReplayState> {
    const { recording, tool_calls } = await this.getRecording(recordingId);

    if (recording.status === "recording") {
      throw new Error("Cannot replay an active recording. Stop it first.");
    }

    const replayId = randomUUID();
    const now = new Date().toISOString();

    const state: ReplayState = {
      replay_id: replayId,
      recording_id: recordingId,
      current_step: 0,
      total_steps: tool_calls.length,
      divergences: [],
      modifications: [],
      status: "paused",
      started_at: now,
      completed_at: null,
    };

    this.activeReplays.set(replayId, state);
    this.evictOldest(this.activeReplays);

    // Store replay metadata in Qdrant
    const embeddingText = `replay of recording ${recordingId} session ${recording.session_id}`;
    const embedding = await this.deps.generateEmbedding(embeddingText);
    if (embedding) {
      const replayPointId = this.deps.generateUUID();
      await this.deps.storePoint(COLLECTION, replayPointId, embedding, {
        point_type: "replay_metadata",
        ...state,
      });
    }

    return state;
  }

  /**
   * Execute the next step in a replay, returning the recorded response.
   * If a modification exists for this step, returns the modified response.
   */
  async replayStep(replayId: string, actualToolName?: string, actualParams?: Record<string, unknown>): Promise<{
    step: number;
    tool_name: string;
    parameters: Record<string, unknown>;
    response: unknown;
    is_modified: boolean;
    divergence: Divergence | null;
  }> {
    const state = this.activeReplays.get(replayId);
    if (!state) {
      throw new Error(`No active replay found: ${replayId}`);
    }
    if (state.status === "completed") {
      throw new Error("Replay already completed");
    }

    if (state.current_step >= state.total_steps) {
      state.status = "completed";
      state.completed_at = new Date().toISOString();
      throw new Error("No more steps to replay");
    }

    state.status = "running";
    const calls = this.recordingCalls.get(state.recording_id);
    if (!calls) {
      throw new Error(`Recording data not loaded for ${state.recording_id}`);
    }

    const step = state.current_step;
    const originalCall = calls[step];

    // Check for modifications on this step
    const modification = state.modifications.find((m) => m.step_number === step);
    let response = originalCall.response;
    let params = originalCall.parameters;
    let isModified = false;

    if (modification) {
      isModified = true;
      if (modification.modification_type === "response_override") {
        response = modification.modified_value;
      } else if (modification.modification_type === "parameter_override") {
        params = modification.modified_value as Record<string, unknown>;
      } else if (modification.modification_type === "skip") {
        state.current_step++;
        return {
          step,
          tool_name: originalCall.tool_name,
          parameters: originalCall.parameters,
          response: { _skipped: true },
          is_modified: true,
          divergence: null,
        };
      }
    }

    // Detect divergence if actual call info is provided
    let divergence: Divergence | null = null;
    if (actualToolName || actualParams) {
      const actualParamsHash = actualParams ? hashValue(sanitizeParams(actualParams)) : originalCall.parameters_hash;
      const actualName = actualToolName || originalCall.tool_name;

      if (actualName !== originalCall.tool_name) {
        divergence = {
          step_number: step,
          type: "tool_mismatch",
          original: {
            tool_name: originalCall.tool_name,
            parameters_hash: originalCall.parameters_hash,
            response_hash: originalCall.response_hash,
          },
          replayed: {
            tool_name: actualName,
            parameters_hash: actualParamsHash,
            response_hash: "",
          },
          description: `Expected tool "${originalCall.tool_name}" but got "${actualName}" at step ${step}`,
        };
      } else if (actualParamsHash !== originalCall.parameters_hash) {
        divergence = {
          step_number: step,
          type: "parameter_mismatch",
          original: {
            tool_name: originalCall.tool_name,
            parameters_hash: originalCall.parameters_hash,
            response_hash: originalCall.response_hash,
          },
          replayed: {
            tool_name: actualName,
            parameters_hash: actualParamsHash,
            response_hash: "",
          },
          description: `Parameter mismatch for "${actualName}" at step ${step}`,
        };
      }

      if (divergence) {
        state.divergences.push(divergence);
      }
    }

    state.current_step++;

    // Auto-complete if we've reached the end
    if (state.current_step >= state.total_steps) {
      state.status = "completed";
      state.completed_at = new Date().toISOString();
    } else {
      state.status = "paused";
    }

    return {
      step,
      tool_name: originalCall.tool_name,
      parameters: params,
      response,
      is_modified: isModified,
      divergence,
    };
  }

  /**
   * Replay all steps in a recording and report divergences.
   * This replays using the recorded data, applying any modifications.
   */
  async replayAll(recordingId: string): Promise<{
    replay_id: string;
    total_steps: number;
    divergences: Divergence[];
    modifications_applied: number;
    steps: Array<{
      step: number;
      tool_name: string;
      response_hash: string;
      is_modified: boolean;
    }>;
  }> {
    const state = await this.startReplay(recordingId);
    const results: Array<{
      step: number;
      tool_name: string;
      response_hash: string;
      is_modified: boolean;
    }> = [];

    while (state.current_step < state.total_steps) {
      const result = await this.replayStep(state.replay_id);
      results.push({
        step: result.step,
        tool_name: result.tool_name,
        response_hash: hashValue(result.response),
        is_modified: result.is_modified,
      });
    }

    return {
      replay_id: state.replay_id,
      total_steps: state.total_steps,
      divergences: state.divergences,
      modifications_applied: state.modifications.length,
      steps: results,
    };
  }

  /**
   * Modify a step's response or parameters for what-if analysis.
   * Must be applied before the step is replayed.
   */
  modifyStep(
    replayId: string,
    stepNumber: number,
    modifications: {
      type: "response_override" | "parameter_override" | "skip" | "inject";
      value?: unknown;
    }
  ): StepModification {
    const state = this.activeReplays.get(replayId);
    if (!state) {
      throw new Error(`No active replay found: ${replayId}`);
    }

    if (stepNumber < 0 || stepNumber >= state.total_steps) {
      throw new Error(`Step ${stepNumber} out of range (0-${state.total_steps - 1})`);
    }

    if (stepNumber < state.current_step) {
      throw new Error(`Step ${stepNumber} already replayed (current step: ${state.current_step}). Start a new replay to modify past steps.`);
    }

    const calls = this.recordingCalls.get(state.recording_id);
    if (!calls) {
      throw new Error(`Recording data not loaded for ${state.recording_id}`);
    }

    const originalCall = calls[stepNumber];
    let originalValue: unknown;
    if (modifications.type === "response_override") {
      originalValue = originalCall.response;
    } else if (modifications.type === "parameter_override") {
      originalValue = originalCall.parameters;
    } else {
      originalValue = null;
    }

    const mod: StepModification = {
      step_number: stepNumber,
      modification_type: modifications.type,
      original_value: originalValue,
      modified_value: modifications.value !== undefined ? modifications.value : null,
      applied_at: new Date().toISOString(),
    };

    // Replace existing modification for the same step if any
    const existingIdx = state.modifications.findIndex((m) => m.step_number === stepNumber);
    if (existingIdx >= 0) {
      state.modifications[existingIdx] = mod;
    } else {
      state.modifications.push(mod);
    }

    return mod;
  }

  /**
   * Compare two execution paths (original recording vs a replayed/modified recording).
   */
  async compareExecutions(
    originalId: string,
    modifiedReplayId: string
  ): Promise<ExecutionComparison> {
    const { recording: originalRec, tool_calls: originalCalls } = await this.getRecording(originalId);

    // For the modified replay, we need the replay state
    const replayState = this.activeReplays.get(modifiedReplayId);
    if (!replayState) {
      // Try treating modifiedReplayId as another recording_id
      const { recording: modifiedRec, tool_calls: modifiedCalls } = await this.getRecording(modifiedReplayId);

      const divergences: Divergence[] = [];
      let divergencePoint: number | null = null;
      const maxSteps = Math.max(originalCalls.length, modifiedCalls.length);

      for (let i = 0; i < maxSteps; i++) {
        const origCall = originalCalls[i];
        const modCall = modifiedCalls[i];

        if (!origCall && modCall) {
          if (divergencePoint === null) divergencePoint = i;
          divergences.push({
            step_number: i,
            type: "path_divergence",
            original: { tool_name: "", parameters_hash: "", response_hash: "" },
            replayed: {
              tool_name: modCall.tool_name,
              parameters_hash: modCall.parameters_hash,
              response_hash: modCall.response_hash,
            },
            description: `Step ${i}: extra step in modified execution (${modCall.tool_name})`,
          });
        } else if (origCall && !modCall) {
          if (divergencePoint === null) divergencePoint = i;
          divergences.push({
            step_number: i,
            type: "path_divergence",
            original: {
              tool_name: origCall.tool_name,
              parameters_hash: origCall.parameters_hash,
              response_hash: origCall.response_hash,
            },
            replayed: { tool_name: "", parameters_hash: "", response_hash: "" },
            description: `Step ${i}: missing step in modified execution (original: ${origCall.tool_name})`,
          });
        } else if (origCall && modCall) {
          if (origCall.tool_name !== modCall.tool_name) {
            if (divergencePoint === null) divergencePoint = i;
            divergences.push({
              step_number: i,
              type: "tool_mismatch",
              original: {
                tool_name: origCall.tool_name,
                parameters_hash: origCall.parameters_hash,
                response_hash: origCall.response_hash,
              },
              replayed: {
                tool_name: modCall.tool_name,
                parameters_hash: modCall.parameters_hash,
                response_hash: modCall.response_hash,
              },
              description: `Step ${i}: tool mismatch ("${origCall.tool_name}" vs "${modCall.tool_name}")`,
            });
          } else if (origCall.response_hash !== modCall.response_hash) {
            if (divergencePoint === null) divergencePoint = i;
            divergences.push({
              step_number: i,
              type: "response_mismatch",
              original: {
                tool_name: origCall.tool_name,
                parameters_hash: origCall.parameters_hash,
                response_hash: origCall.response_hash,
              },
              replayed: {
                tool_name: modCall.tool_name,
                parameters_hash: modCall.parameters_hash,
                response_hash: modCall.response_hash,
              },
              description: `Step ${i}: response differs for "${origCall.tool_name}"`,
            });
          }
        }
      }

      return {
        original_id: originalId,
        modified_id: modifiedReplayId,
        original_steps: originalCalls.length,
        modified_steps: modifiedCalls.length,
        divergence_point: divergencePoint,
        divergences,
        summary: divergences.length === 0
          ? "Executions are identical"
          : `${divergences.length} divergence(s) detected, first at step ${divergencePoint}`,
      };
    }

    // Compare original recording against replay state
    const divergences = replayState.divergences;
    const divergencePoint = divergences.length > 0
      ? Math.min(...divergences.map((d) => d.step_number))
      : null;

    // Account for modifications as implicit divergences
    for (const mod of replayState.modifications) {
      const alreadyLogged = divergences.some((d) => d.step_number === mod.step_number);
      if (!alreadyLogged) {
        const origCall = originalCalls[mod.step_number];
        if (origCall) {
          divergences.push({
            step_number: mod.step_number,
            type: "response_mismatch",
            original: {
              tool_name: origCall.tool_name,
              parameters_hash: origCall.parameters_hash,
              response_hash: origCall.response_hash,
            },
            replayed: {
              tool_name: origCall.tool_name,
              parameters_hash: mod.modification_type === "parameter_override"
                ? hashValue(mod.modified_value)
                : origCall.parameters_hash,
              response_hash: mod.modification_type === "response_override"
                ? hashValue(mod.modified_value)
                : origCall.response_hash,
            },
            description: `Step ${mod.step_number}: modified (${mod.modification_type})`,
          });
        }
      }
    }

    divergences.sort((a, b) => a.step_number - b.step_number);

    const effectiveDivergencePoint = divergences.length > 0
      ? Math.min(...divergences.map((d) => d.step_number))
      : null;

    return {
      original_id: originalId,
      modified_id: modifiedReplayId,
      original_steps: originalCalls.length,
      modified_steps: replayState.current_step,
      divergence_point: effectiveDivergencePoint,
      divergences,
      summary: divergences.length === 0
        ? "No divergences detected"
        : `${divergences.length} divergence(s), first at step ${effectiveDivergencePoint}`,
    };
  }

  /**
   * Get a visual timeline of all tool calls with timing.
   */
  async getTimeline(recordingId: string): Promise<{
    recording_id: string;
    session_id: string;
    total_duration_ms: number;
    entries: TimelineEntry[];
  }> {
    const { recording, tool_calls } = await this.getRecording(recordingId);

    const entries: TimelineEntry[] = tool_calls.map((call, idx) => {
      // Calculate duration as diff to next call (or null for last)
      let durationMs: number | null = null;
      if (idx < tool_calls.length - 1) {
        const current = new Date(call.timestamp).getTime();
        const next = new Date(tool_calls[idx + 1].timestamp).getTime();
        durationMs = next - current;
      }

      // Check if any replay has modifications for this step
      let hasModification = false;
      for (const replay of this.activeReplays.values()) {
        if (replay.recording_id === recordingId) {
          hasModification = replay.modifications.some((m) => m.step_number === idx);
          if (hasModification) break;
        }
      }

      return {
        step: call.sequence_number - 1,
        tool_name: call.tool_name,
        timestamp: call.timestamp,
        duration_ms: durationMs,
        parameters_hash: call.parameters_hash,
        response_hash: call.response_hash,
        has_modification: hasModification,
      };
    });

    // Total duration from first to last call
    let totalDurationMs = 0;
    if (tool_calls.length >= 2) {
      const first = new Date(tool_calls[0].timestamp).getTime();
      const last = new Date(tool_calls[tool_calls.length - 1].timestamp).getTime();
      totalDurationMs = last - first;
    }

    return {
      recording_id: recordingId,
      session_id: recording.session_id,
      total_duration_ms: totalDurationMs,
      entries,
    };
  }

  /**
   * Delete a recording and all its associated tool calls from Qdrant.
   */
  async deleteRecording(recordingId: string): Promise<{ deleted: boolean; recording_id: string }> {
    // Remove from in-memory caches
    this.activeRecordings.delete(recordingId);
    this.recordingCalls.delete(recordingId);

    // Remove any replays associated with this recording
    for (const [replayId, state] of this.activeReplays.entries()) {
      if (state.recording_id === recordingId) {
        this.activeReplays.delete(replayId);
      }
    }

    // Delete from Qdrant: recording metadata
    const metaPoints = await this.deps.scrollPoints(
      COLLECTION,
      {
        must: [
          { key: "recording_id", match: { value: recordingId } },
        ],
      },
      1000
    );

    if (metaPoints.length > 0) {
      const ids = metaPoints
        .map((p) => (p as { id?: string }).id)
        .filter((id): id is string => typeof id === "string");

      if (ids.length > 0) {
        if (this.deps.deletePoints) {
          // Use proper deletion when available
          await this.deps.deletePoints(COLLECTION, ids);
        } else {
          // Fallback: overwrite with tombstone if deletePoints not available
          for (const id of ids) {
            const embedding = await this.deps.generateEmbedding("deleted recording tombstone");
            if (embedding) {
              await this.deps.storePoint(COLLECTION, id, embedding, {
                point_type: "deleted",
                recording_id: recordingId,
                deleted_at: new Date().toISOString(),
              });
            }
          }
        }
      }
    }

    return { deleted: true, recording_id: recordingId };
  }

  /**
   * Get the current state of a replay.
   */
  getReplayState(replayId: string): ReplayState | null {
    return this.activeReplays.get(replayId) || null;
  }

  /**
   * List all active replays.
   */
  listReplays(): ReplayState[] {
    return Array.from(this.activeReplays.values());
  }

  /**
   * Get the active recording ID for a session, if any.
   */
  getActiveRecordingForSession(sessionId: string): string | null {
    for (const [id, rec] of this.activeRecordings.entries()) {
      if (rec.session_id === sessionId && rec.status === "recording") {
        return id;
      }
    }
    return null;
  }
}
