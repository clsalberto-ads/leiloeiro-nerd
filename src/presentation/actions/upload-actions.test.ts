import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  deleteItemImage: vi.fn(),
  utapi: { uploadFiles: vi.fn() },
}));

vi.mock("./auth-actions", () => ({ getSession: mocks.getSession }));
vi.mock("@/application/use-cases/delete-item-image", () => ({
  deleteItemImage: mocks.deleteItemImage,
}));
vi.mock("@/infrastructure/database/repositories/drizzle-item-repository", () => ({
  drizzleItemRepository: {},
}));
vi.mock("@/infrastructure/upload/uploadthing", () => ({ utapi: mocks.utapi }));

import { deleteItemImageAction, uploadItemImagesAction } from "./upload-actions";

function filesWith(files: File[]) {
  const formData = new FormData();
  for (const f of files) formData.append("images", f);
  return formData;
}

function file(size: number, type = "image/jpeg", name = "a.jpg") {
  return new File([new Uint8Array(size)], name, { type });
}

describe("uploadItemImagesAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ user: { id: "u1" } });
  });

  it("retorna erro quando não autenticado", async () => {
    mocks.getSession.mockResolvedValue(null);
    await expect(uploadItemImagesAction(null, filesWith([]))).resolves.toEqual({ error: "Não autenticado" });
    expect(mocks.utapi.uploadFiles).not.toHaveBeenCalled();
  });

  it("retorna urls dos uploads", async () => {
    mocks.utapi.uploadFiles.mockResolvedValue([{ data: { ufsUrl: "https://ut.ex/a.jpg" }, error: null }]);
    await expect(
      uploadItemImagesAction(null, filesWith([file(1024)])),
    ).resolves.toEqual({ urls: ["https://ut.ex/a.jpg"] });
  });

  it("filtra uploads com erro e retorna erro se nenhum teve sucesso", async () => {
    mocks.utapi.uploadFiles.mockResolvedValue([
      { data: { ufsUrl: "https://ut.ex/a.jpg" }, error: null },
      { data: null, error: "boom" },
    ]);
    await expect(uploadItemImagesAction(null, filesWith([file(1024), file(2048)]))).resolves.toEqual({
      urls: ["https://ut.ex/a.jpg"],
    });

    mocks.utapi.uploadFiles.mockResolvedValue([{ data: null, error: "boom" }]);
    await expect(
      uploadItemImagesAction(null, filesWith([file(1024)])),
    ).resolves.toEqual({ error: "Não foi possível enviar as imagens." });
  });

  it("rejeita mais de 10 imagens", async () => {
    await expect(
      uploadItemImagesAction(null, filesWith(Array.from({ length: 11 }, () => file(1024)))),
    ).resolves.toEqual({ error: "Máximo 10 imagens" });
    expect(mocks.utapi.uploadFiles).not.toHaveBeenCalled();
  });

  it("rejeita arquivo acima de 8MB", async () => {
    await expect(
      uploadItemImagesAction(null, filesWith([file(8 * 1024 * 1024 + 1)])),
    ).resolves.toEqual({ error: "Máximo 8MB por imagem" });
  });

  it("rejeita arquivo que não é imagem", async () => {
    await expect(uploadItemImagesAction(null, filesWith([file(100, "text/plain", "a.txt")]))).resolves.toEqual({
      error: "Apenas imagens",
    });
  });

  it("retorna erro quando o upload lança exceção", async () => {
    mocks.utapi.uploadFiles.mockRejectedValue(new Error("ut down"));
    await expect(uploadItemImagesAction(null, filesWith([file(1024)]))).resolves.toEqual({ error: "ut down" });
  });
});

describe("deleteItemImageAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ user: { id: "u1" } });
  });

  it("retorna erro quando não autenticado", async () => {
    mocks.getSession.mockResolvedValue(null);
    const fd = new FormData();
    fd.set("imageId", "img1");
    await expect(deleteItemImageAction(null, fd)).resolves.toEqual({ error: "Não autenticado" });
  });

  it("retorna ok quando a exclusão é bem-sucedida", async () => {
    mocks.deleteItemImage.mockResolvedValue(undefined);
    const fd = new FormData();
    fd.set("imageId", "img1");
    await expect(deleteItemImageAction(null, fd)).resolves.toEqual({ ok: true });
    expect(mocks.deleteItemImage).toHaveBeenCalledWith(expect.anything(), "u1", "img1");
  });

  it("retorna erro quando o use case lança", async () => {
    mocks.deleteItemImage.mockRejectedValue(new Error("Sem permissão"));
    const fd = new FormData();
    fd.set("imageId", "img1");
    await expect(deleteItemImageAction(null, fd)).resolves.toEqual({ error: "Sem permissão" });
  });
});