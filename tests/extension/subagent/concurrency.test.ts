import { describe, expect, test, beforeEach, afterEach } from "vitest";
import {
  Semaphore,
  getSubagentConcurrency,
  DEFAULT_SUBAGENT_CONCURRENCY,
} from "../../../extensions/subagent/concurrency.js";

describe("getSubagentConcurrency", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("returns default when no env override", () => {
    delete process.env.PI_SUBAGENT_CONCURRENCY;
    expect(getSubagentConcurrency()).toBe(DEFAULT_SUBAGENT_CONCURRENCY);
  });

  test("reads from PI_SUBAGENT_CONCURRENCY env var", () => {
    process.env.PI_SUBAGENT_CONCURRENCY = "3";
    expect(getSubagentConcurrency()).toBe(3);
  });

  test("ignores invalid values", () => {
    process.env.PI_SUBAGENT_CONCURRENCY = "abc";
    expect(getSubagentConcurrency()).toBe(DEFAULT_SUBAGENT_CONCURRENCY);
  });

  test("clamps to minimum of 1", () => {
    process.env.PI_SUBAGENT_CONCURRENCY = "0";
    expect(getSubagentConcurrency()).toBe(1);
  });
});

describe("Semaphore", () => {
  test("allows up to limit concurrent acquisitions", async () => {
    const sem = new Semaphore(2);
    const release1 = await sem.acquire();
    const release2 = await sem.acquire();
    expect(sem.active).toBe(2);
    expect(sem.waiting).toBe(0);
    release1();
    release2();
  });

  test("queues when limit is reached", async () => {
    const sem = new Semaphore(1);
    const release1 = await sem.acquire();
    expect(sem.active).toBe(1);

    let acquired = false;
    const pendingAcquire = sem.acquire().then((release) => {
      acquired = true;
      return release;
    });

    // Give microtask a chance to resolve
    await new Promise((r) => setTimeout(r, 10));
    expect(acquired).toBe(false);
    expect(sem.waiting).toBe(1);

    release1();
    const release2 = await pendingAcquire;
    expect(acquired).toBe(true);
    expect(sem.active).toBe(1);
    expect(sem.waiting).toBe(0);
    release2();
  });

  test("processes queue in FIFO order", async () => {
    const sem = new Semaphore(1);
    const order: number[] = [];

    const release1 = await sem.acquire();

    const p2 = sem.acquire().then((r) => {
      order.push(2);
      return r;
    });
    const p3 = sem.acquire().then((r) => {
      order.push(3);
      return r;
    });

    release1();
    const r2 = await p2;
    r2();
    const r3 = await p3;
    r3();

    expect(order).toEqual([2, 3]);
  });

  test("double release is safe", async () => {
    const sem = new Semaphore(1);
    const release = await sem.acquire();
    release();
    release(); // should not throw or double-decrement
    expect(sem.active).toBe(0);
  });
});
