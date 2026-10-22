import { describe, expect, it, vi } from "vitest";
import { displayNameFromEmail, resolveOrLinkUser } from "./resolve-user.js";
import type { StoreUser, UserStore } from "./user-store.js";

const claims = { sub: "auth-1", email: "Andre@Example.com", emailVerified: true };
const existing: StoreUser = { id: "user-1", email: "andre@example.com", displayName: "Andre" };

function fakeStore(seed: {
  byAuthId?: StoreUser | null;
  byEmail?: StoreUser | null;
  link?: boolean;
  createError?: unknown;
}) {
  const store: UserStore = {
    findByAuthId: vi.fn(async () => seed.byAuthId ?? null),
    findUnlinkedByEmail: vi.fn(async () => seed.byEmail ?? null),
    link: vi.fn(async () => seed.link ?? true),
    create: vi.fn(async (input) => {
      if (seed.createError) throw seed.createError;
      return { id: "created-id", email: input.email, displayName: input.displayName };
    }),
    findById: vi.fn(async () => null),
  };
  return store;
}

describe("resolveOrLinkUser", () => {
  it("usa quem já está ligado pelo sub, sem consultar e-mail", async () => {
    const store = fakeStore({ byAuthId: existing });
    await expect(resolveOrLinkUser(store, claims, true)).resolves.toEqual({ user: existing });
    expect(store.findUnlinkedByEmail).not.toHaveBeenCalled();
    expect(store.link).not.toHaveBeenCalled();
    expect(store.create).not.toHaveBeenCalled();
  });

  it("liga ao usuário de mesmo e-mail (minúsculo) no primeiro login", async () => {
    const store = fakeStore({ byEmail: existing });
    await expect(resolveOrLinkUser(store, claims, true)).resolves.toEqual({ user: existing });
    expect(store.findUnlinkedByEmail).toHaveBeenCalledWith("andre@example.com");
    expect(store.link).toHaveBeenCalledWith("auth-1", "user-1");
    expect(store.create).not.toHaveBeenCalled();
  });

  it("relê o vínculo quando perde a corrida da ligação", async () => {
    const store = fakeStore({ byEmail: existing, link: false });
    vi.mocked(store.findByAuthId).mockResolvedValueOnce(null).mockResolvedValueOnce(existing);

    await expect(resolveOrLinkUser(store, claims, true)).resolves.toEqual({ user: existing });
    expect(store.findByAuthId).toHaveBeenCalledTimes(2);
  });

  it("nega quando a corrida foi vencida por outra conta", async () => {
    const store = fakeStore({ byEmail: existing, link: false });
    vi.mocked(store.findByAuthId).mockResolvedValue(null);

    await expect(resolveOrLinkUser(store, claims, true)).resolves.toEqual({ error: "not allowed" });
  });

  it("cria usuário novo com displayName do e-mail", async () => {
    const store = fakeStore({});
    await expect(resolveOrLinkUser(store, claims, true)).resolves.toEqual({
      user: { id: "created-id", email: "andre@example.com", displayName: "andre" },
    });
    expect(store.create).toHaveBeenCalledWith({
      email: "andre@example.com",
      displayName: "andre",
      authUserId: "auth-1",
    });
  });

  it("em corrida de criação, relê o vínculo vencedor", async () => {
    const store = fakeStore({ createError: Object.assign(new Error("unique"), { code: "P2002" }) });
    vi.mocked(store.findByAuthId).mockResolvedValueOnce(null).mockResolvedValueOnce(existing);

    await expect(resolveOrLinkUser(store, claims, true)).resolves.toEqual({ user: existing });
  });

  it("não cria nem liga fora da allowlist", async () => {
    const store = fakeStore({ byEmail: existing });
    await expect(resolveOrLinkUser(store, claims, false)).resolves.toEqual({ error: "not allowed" });
    expect(store.findUnlinkedByEmail).not.toHaveBeenCalled();
    expect(store.create).not.toHaveBeenCalled();
    expect(store.link).not.toHaveBeenCalled();
  });

  it("não cria nem liga e-mail não verificado", async () => {
    const store = fakeStore({ byEmail: existing });
    await expect(resolveOrLinkUser(store, { ...claims, emailVerified: false }, true)).resolves.toEqual({
      error: "email not verified",
    });
    expect(store.findUnlinkedByEmail).not.toHaveBeenCalled();
    expect(store.create).not.toHaveBeenCalled();
  });
});

describe("displayNameFromEmail", () => {
  it("usa a parte antes do @", () => {
    expect(displayNameFromEmail("andre@example.com")).toBe("andre");
  });

  it("tem fallback para e-mail sem parte local", () => {
    expect(displayNameFromEmail("@example.com")).toBe("Você");
  });
});
