import { expect } from "vitest";

type Handler = (event: any, ctx: any) => any;

export function createFakePi(extra?: { withAppendEntry?: boolean }) {
  const handlers = new Map<string, Handler[]>();
  const appendedEntries: any[] = [];

  return {
    handlers,
    appendedEntries,
    api: {
      on(event: string, handler: Handler) {
        const list = handlers.get(event) ?? [];
        list.push(handler);
        handlers.set(event, list);
      },
      registerTool() {},
      registerCommand() {},
      appendEntry(customType: string, data: any) {
        if (extra?.withAppendEntry) appendedEntries.push({ customType, data });
      },
    },
  };
}

export function getSingleHandler(handlers: Map<string, Handler[]>, event: string): Handler {
  const list = handlers.get(event) ?? [];
  expect(list.length).toBeGreaterThan(0);
  return list[0]!;
}

export function getHandlers(handlers: Map<string, Handler[]>, event: string): Handler[] {
  return handlers.get(event) ?? [];
}
