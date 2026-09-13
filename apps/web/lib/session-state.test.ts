import { describe, expect, it, vi } from "vitest";
import { observeSession } from "./session-state";
function setup() {
  let event: (name: string, session: unknown) => void = () => {};
  let resolve!: (value: unknown) => void;
  const unsubscribe = vi.fn();
  const auth = {
    onAuthStateChange: vi.fn((cb) => {
      event = cb;
      return { data: { subscription: { unsubscribe } } };
    }),
    getSession: vi.fn(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    ),
  };
  const update = vi.fn();
  const stop = observeSession(
    auth as unknown as Parameters<typeof observeSession>[0],
    update,
  );
  return {
    update,
    stop,
    unsubscribe,
    event: (session: unknown) => event("CHANGE", session),
    resolve,
  };
}
const settle = () => new Promise((r) => setTimeout(r, 0));
describe("header session state", () => {
  it("recognizes a persisted session without requiring a gate visit", async () => {
    const s = setup();
    s.resolve({ data: { session: {} }, error: null });
    await settle();
    expect(s.update).toHaveBeenLastCalledWith("signed-in");
  });
  it("follows sign-in and sign-out events", () => {
    const s = setup();
    s.event({});
    expect(s.update).toHaveBeenLastCalledWith("signed-in");
    s.event(null);
    expect(s.update).toHaveBeenLastCalledWith("signed-out");
  });
  it("does not overwrite a newer sign-out with a stale session read", async () => {
    const s = setup();
    s.event(null);
    s.resolve({ data: { session: {} }, error: null });
    await settle();
    expect(s.update).toHaveBeenCalledTimes(1);
    expect(s.update).toHaveBeenLastCalledWith("signed-out");
  });
  it("does not mistake a failed read for signing out", async () => {
    const s = setup();
    s.resolve({ data: { session: null }, error: new Error("offline") });
    await settle();
    expect(s.update).toHaveBeenLastCalledWith("unavailable");
  });
  it("cleans up and ignores pending reads after unmount", async () => {
    const s = setup();
    s.stop();
    s.resolve({ data: { session: {} }, error: null });
    await settle();
    expect(s.unsubscribe).toHaveBeenCalledOnce();
    expect(s.update).not.toHaveBeenCalled();
  });
});
