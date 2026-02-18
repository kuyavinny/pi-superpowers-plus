import { describe, expect, test } from "vitest";
import { ProcessTracker } from "../../../extensions/subagent/lifecycle.js";

describe("ProcessTracker", () => {
  test("tracks added processes", () => {
    const tracker = new ProcessTracker();
    const fakeProc = { pid: 1, killed: false, kill: () => {} } as any;
    tracker.add(fakeProc);
    expect(tracker.size).toBe(1);
  });

  test("removes processes", () => {
    const tracker = new ProcessTracker();
    const fakeProc = { pid: 1, killed: false, kill: () => {} } as any;
    tracker.add(fakeProc);
    tracker.remove(fakeProc);
    expect(tracker.size).toBe(0);
  });

  test("killAll sends SIGTERM to all tracked processes", () => {
    const tracker = new ProcessTracker();
    const kills: string[] = [];
    const proc1 = { pid: 1, killed: false, kill: (sig: string) => kills.push(`1:${sig}`) } as any;
    const proc2 = { pid: 2, killed: false, kill: (sig: string) => kills.push(`2:${sig}`) } as any;
    tracker.add(proc1);
    tracker.add(proc2);
    tracker.killAll();
    expect(kills).toEqual(["1:SIGTERM", "2:SIGTERM"]);
  });

  test("killAll skips already-killed processes", () => {
    const tracker = new ProcessTracker();
    const kills: string[] = [];
    const proc1 = { pid: 1, killed: true, kill: (sig: string) => kills.push(`1:${sig}`) } as any;
    tracker.add(proc1);
    tracker.killAll();
    expect(kills).toEqual([]);
  });
});
