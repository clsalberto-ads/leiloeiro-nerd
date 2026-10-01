import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  signInEmail: vi.fn(),
  signUpEmail: vi.fn(),
}));

// ponytail: o `redirect` real LANCA (NEXT_REDIRECT) e nao devolve. Um mock que
// so registra deixaria a action seguir para o `return { ok: true }` e o teste
// passaria a testar o mock. Lanca, como o Next.
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect.mockImplementation((destino: string): never => {
    throw new Error(`NEXT_REDIRECT:${destino}`);
  }),
}));

vi.mock("@/infrastructure/auth/better-auth", () => ({
  auth: { api: { signInEmail: mocks.signInEmail, signUpEmail: mocks.signUpEmail } },
}));

import { signInAction, signUpAction } from "./auth-actions";

function form(dados: Record<string, string>) {
  const fd = new FormData();
  for (const [chave, valor] of Object.entries(dados)) fd.append(chave, valor);
  return fd;
}

const LOGIN_VALIDO = { email: "ana@ex.com", password: "SenhaForte123!" };
const CADASTRO_VALIDO = { email: "ana@ex.com", password: "SenhaForte123!", name: "Ana" };

// ponytail: sem redirect, o login/cadastro deixa o usuario parado numa pagina
// que so oferece um link para o painel. A action precisa empurrar: e o que
// `signOutAction` e todas as `item-actions` ja fazem, e o que o spec pede
// ("registro -> login -> /dashboard acessivel").
describe("auth-actions — depois de autenticar, o usuario vai para o painel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.redirect.mockImplementation((destino: string): never => {
      throw new Error(`NEXT_REDIRECT:${destino}`);
    });
  });

  it("login com credenciais validas redireciona para /dashboard", async () => {
    await expect(signInAction({}, form(LOGIN_VALIDO))).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("cadastro valido redireciona para /dashboard", async () => {
    await expect(signUpAction({}, form(CADASTRO_VALIDO))).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard");
  });

  // ponytail: o guard vem ANTES do redirect. Sem estes dois, um e-mail duplicado
  // arrancaria o usuario do formulario e o levaria ao painel sem sessao — que e
  // exatamente o bug que o `error` existe para reportar.
  it("credenciais invalidas nao redirecionam: erro fica na pagina", async () => {
    mocks.signInEmail.mockRejectedValue(new Error("bad"));

    await expect(signInAction({}, form(LOGIN_VALIDO))).resolves.toEqual({ error: "Credenciais inválidas" });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("cadastro com e-mail ja existente nao redireciona", async () => {
    mocks.signUpEmail.mockRejectedValue(new Error("duplicate"));

    await expect(signUpAction({}, form(CADASTRO_VALIDO))).resolves.toMatchObject({ error: expect.any(String) });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("dados invalidos por zod nao chega ao auth nem redireciona", async () => {
    const resultado = await signInAction({}, form({ email: "nao-e-email", password: "" }));

    expect(resultado).toMatchObject({ error: expect.any(String) });
    expect(mocks.signInEmail).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
