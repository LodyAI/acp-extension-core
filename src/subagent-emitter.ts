import {
  isLodySubagentOutput,
  type LodySubagentEvent,
  type LodySubagentSnapshot,
  type LodySubagentProgress,
} from './subagent-events.js';

/** One activation of a root ACP session. Native identifiers never become run IDs. */
export class LodySubagentEmitter {
  private readonly runs = new Map<string, { runId: string; snapshot: LodySubagentSnapshot }>();
  constructor(
    readonly sessionId: string,
    private readonly send: (event: LodySubagentEvent) => Promise<void> | void,
    private readonly newId: () => string = () => crypto.randomUUID(),
  ) {}

  get(nativeId: string) {
    return this.runs.get(nativeId);
  }

  async start(nativeId: string, snapshot: LodySubagentSnapshot): Promise<void> {
    const previous = this.get(nativeId);
    if (previous && this.live(nativeId)) return;
    const run = { runId: this.newId(), snapshot };
    this.runs.set(nativeId, run);
    await this.send({
      version: 1,
      sessionId: this.sessionId,
      runId: run.runId,
      type: 'snapshot',
      snapshot,
    });
  }

  live(nativeId: string): boolean {
    const state = this.get(nativeId)?.snapshot.state;
    return state === 'pending' || state === 'running';
  }

  async snapshot(nativeId: string, patch: Partial<LodySubagentSnapshot>): Promise<void> {
    const run = this.get(nativeId);
    if (!run || !this.live(nativeId)) return;
    run.snapshot = { ...run.snapshot, ...patch };
    await this.send({
      version: 1,
      sessionId: this.sessionId,
      runId: run.runId,
      type: 'snapshot',
      snapshot: run.snapshot,
    });
  }

  async progress(nativeId: string, progress: LodySubagentProgress): Promise<void> {
    const run = this.get(nativeId);
    if (!run || !this.live(nativeId)) return;
    await this.send({
      version: 1,
      sessionId: this.sessionId,
      runId: run.runId,
      type: 'progress',
      progress,
    });
  }

  async output(
    nativeId: string,
    update: unknown,
    ids: { nativeTurnId?: string; messageId?: string } = {},
  ): Promise<void> {
    const run = this.get(nativeId);
    if (!run || !this.live(nativeId)) return;
    if (!isLodySubagentOutput(update)) {
      await this.snapshot(nativeId, { outputIncomplete: true });
      return;
    }
    await this.send({
      version: 1,
      sessionId: this.sessionId,
      runId: run.runId,
      type: 'output',
      update,
      ...ids,
    });
  }

  async disconnect(): Promise<void> {
    for (const nativeId of this.runs.keys()) {
      await this.snapshot(nativeId, {
        state: 'unknown',
        outputIncomplete: true,
        reason: { code: 'disconnected' },
      });
    }
  }
}
