import { describe, expect, it, vi } from "vitest";
import { finishAuthCallback, callbackFailure } from "./auth-callback";
function client() {
  return {
    initialize: vi.fn().mockResolvedValue({ error: null }),
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    exchangeCodeForSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "test" } } }, error: null }),
  };
}
const finish = (auth: ReturnType<typeof client>, code: string | null) => finishAuthCallback(auth as unknown as Parameters<typeof finishAuthCallback>[0], code);
describe("sign-in callback", () => {
  it("does not exchange again after SDK auto-detection succeeds", async () => {
    const auth=client(); auth.getSession.mockResolvedValue({data:{session:{user:{id:"test"}}},error:null});
    expect((await finish(auth,"test-code")).signedIn).toBe(true);
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });
  it("shares one exchange across Strict Mode callers", async () => {
    const auth=client(); const results=await Promise.all([finish(auth,"test-code"),finish(auth,"test-code")]);
    expect(results.every(r=>r.signedIn)).toBe(true);
    expect(auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
  });
  it("reports SDK callback errors without consuming the code twice", async () => {
    const auth=client();auth.initialize.mockResolvedValue({error:{message:"expired"}});
    expect(await finish(auth,"test-code")).toEqual({signedIn:false,error:callbackFailure});
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });
  it("explains a missing verifier or rejected exchange", async () => {
    const auth=client();auth.exchangeCodeForSession.mockResolvedValue({data:{session:null},error:{message:"missing verifier"}});
    expect(await finish(auth,"test-code")).toEqual({signedIn:false,error:callbackFailure});
  });
  it("does nothing on a normal signed-out visit", async () => {
    const auth=client();expect(await finish(auth,null)).toEqual({signedIn:false,error:null});
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });
  it("handles connection failures", async () => {
    const auth=client();auth.initialize.mockRejectedValue(new Error("offline"));
    expect((await finish(auth,"test-code")).error).toContain("Check your connection");
  });
});
