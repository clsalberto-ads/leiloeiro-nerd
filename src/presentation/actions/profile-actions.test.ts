import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  updateProfile: vi.fn(),
  becomeSeller: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("./auth-actions", () => ({ getSession: mocks.getSession }));
vi.mock("@/application/use-cases/update-profile", () => ({ updateProfile: mocks.updateProfile }));
vi.mock("@/application/use-cases/become-seller", () => ({ becomeSeller: mocks.becomeSeller }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/infrastructure/database/repositories/drizzle-user-repository", () => ({
  drizzleUserRepository: {},
}));

import { becomeSellerAction, updateProfileAction } from "./profile-actions";

const SESSAO = { user: { id: "u1", name: "Ana", email: "ana@ex.com", role: "bidder" } };

/** Reproduz o que o browser manda: todo input do form entra, vazio ou nao. */
function formDe(campos: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}

describe("updateProfileAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue(SESSAO);
    mocks.updateProfile.mockResolvedValue(undefined);
  });

  // ponytail: este e o bug que o usuario batia. O form de configuracoes tem um
  // `<input name="name">` sem `required` e sem `defaultValue`, entao um
  // `<input>` intocado chega no FormData como `name: ""` — presente, e nao
  // ausente. O schema era `z.string().min(2).optional()`, e `optional()` so
  // perdoa `undefined`: o `""` reprovava no `min(2)` e o `updateProfile` NUNCA
  // era alcancado. Quem abria /dashboard/settings para trocar so o celular
  // recebia "Nome muito curto" e nada era salvo, a menos que reescrevesse o
  // nome inteiro. A traducao `v || undefined` e a mesma dos outros tres campos.
  it("salva quando o usuario so mexe no telefone e o nome fica vazio", async () => {
    const r = await updateProfileAction(null, formDe({ name: "", phone: "+55 11 99999-0000" }));
    expect(r).toEqual({ ok: true });
    expect(mocks.updateProfile).toHaveBeenCalledWith(expect.anything(), "u1", {
      name: undefined,
      phone: "+55 11 99999-0000",
      slug: undefined,
      address: undefined,
    });
  });

  it("nao envia NENHUM campo quando o form volta inteiro vazio", async () => {
    await updateProfileAction(null, formDe({ name: "", phone: "", slug: "", address: "" }));
    expect(mocks.updateProfile).toHaveBeenCalledWith(expect.anything(), "u1", {
      name: undefined,
      phone: undefined,
      slug: undefined,
      address: undefined,
    });
  });

  it("ainda rejeita um nome com 1 caractere", async () => {
    const r = await updateProfileAction(null, formDe({ name: "A" }));
    expect(r.error).toBe("Nome muito curto");
    expect(mocks.updateProfile).not.toHaveBeenCalled();
  });

  it("nao devolve a mensagem do driver ao usuario", async () => {
    mocks.updateProfile.mockRejectedValue(
      Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:5432"), { code: "ECONNREFUSED" }),
    );
    const r = await updateProfileAction(null, formDe({ name: "Ana" }));
    expect(r.error).not.toContain("ECONNREFUSED");
    expect(r.error).toBe("Não foi possível salvar o perfil. Tente novamente.");
  });

  // ponytail: a pagina de configuracoes e um SERVER component que le
  // `session.user.role` para decidir se mostra o `BecomeSellerForm`
  // (settings/page.tsx). Sem revalidar, apos "Conta de leiloeiro ativada." o
  // formulario continuava la — e clicar de novo reexecutava o `becomeSeller`,
  // reescrevendo o slug publico em silencio. Nao havia um unico
  // `revalidatePath` no projeto inteiro.
  it("revalida a pagina de configuracoes depois de salvar", async () => {
    await updateProfileAction(null, formDe({ name: "Ana" }));
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/settings");
  });
});

describe("becomeSellerAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue(SESSAO);
    mocks.becomeSeller.mockResolvedValue(undefined);
  });

  it("revalida a pagina de configuracoes depois de ativar", async () => {
    await becomeSellerAction(null, formDe({ slug: "nerd-colecionaveis", role: "seller" }));
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/settings");
  });

  it("traduz slug duplicado para a mensagem de negocio", async () => {
    mocks.becomeSeller.mockRejectedValue(
      Object.assign(new Error('duplicate key value violates unique constraint "user_slug_key"'), { code: "23505" }),
    );
    const r = await becomeSellerAction(null, formDe({ slug: "nerd", role: "seller" }));
    expect(r.error).toBe("Este slug já está em uso");
  });

  // ponytail: a `updateProfileAction` dava mensagem generica neste exato branch
  // desde sempre; aqui o `raw` ia direto para o browser. `permission denied for
  // schema user` e `ECONNREFUSED host:port` nao sao corrigiveis pelo usuario e o
  // segundo entrega a topologia do banco.
  it("nao devolve a mensagem do driver ao usuario", async () => {
    mocks.becomeSeller.mockRejectedValue(
      Object.assign(new Error("permission denied for schema user"), { code: "42501" }),
    );
    const r = await becomeSellerAction(null, formDe({ slug: "nerd", role: "seller" }));
    expect(r.error).not.toContain("permission denied");
    expect(r.error).not.toContain("schema user");
  });
});
