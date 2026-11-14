import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, createGuestAccount } from "./api";

describe("createGuestAccount", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the parsed session on success", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ accessToken: "t", accountId: "a" }), { status: 201 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const session = await createGuestAccount("http://localhost:3001");

    expect(session).toEqual({ accessToken: "t", accountId: "a" });
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3001/auth/guest", {
      method: "POST",
    });
  });

  it("throws ApiError when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 500 })),
    );

    await expect(createGuestAccount("http://localhost:3001")).rejects.toThrow(ApiError);
  });
});
