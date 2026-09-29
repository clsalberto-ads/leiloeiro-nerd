import { describe, expect, it } from "vitest";
import { updateItem } from "./update-item";
import type { Item, ItemRepository } from "@/domain/repositories/item-repository";

const baseItem: Item = {
  id: "i1",
  sellerId: "u1",
  title: "Action Figure rara",
  description: "Colecionável lacrado, edição limitada.",
  type: "product",
  imageUrl: null,
  minInitialBid: 5000,
  minBidIncrement: 500,
  bidDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  paymentDeadlineDays: 3,
  status: "draft",
  createdAt: new Date(),
  updatedAt: new Date(),
};

class FakeItemRepository implements ItemRepository {
  imagesCaptures: { itemId: string; urls: string[] }[] = [];
  constructor(private item: Item | null, private bidCount = 0) {}
  async create() {
    return baseItem;
  }
  async update(_: string, input: Partial<Item>) {
    if (!this.item) return null;
    this.item = { ...this.item, ...input };
    return this.item;
  }
  async findById() {
    return this.item;
  }
  async findBySellerId() {
    return [];
  }
  async delete() {}
  async setStatus() {
    return this.item;
  }
  async countBids() {
    return this.bidCount;
  }
  async findImagesByItemId() {
    return [];
  }
  async findImageById() {
    return null;
  }
  async createImages(itemId: string, urls: string[]) {
    this.imagesCaptures.push({ itemId, urls });
    return [];
  }
  async deleteImage() {}
}

describe("updateItem", () => {
  it("permite atualizar item em draft", async () => {
    const repo = new FakeItemRepository(baseItem);
    const result = await updateItem(repo, "u1", "i1", { title: "Novo título" });
    expect(result.title).toBe("Novo título");
  });

  it("bloqueia edição de item publicado", async () => {
    const repo = new FakeItemRepository({ ...baseItem, status: "active" });
    await expect(updateItem(repo, "u1", "i1", { title: "X" })).rejects.toThrow("Item publicado não pode ser editado");
  });

  it("bloqueia edição quando há lances", async () => {
    const repo = new FakeItemRepository(baseItem, 1);
    await expect(updateItem(repo, "u1", "i1", { title: "X" })).rejects.toThrow("Item com lances não pode ser editado");
  });

  it("lança erro se item não existe", async () => {
    const repo = new FakeItemRepository(null);
    await expect(updateItem(repo, "u1", "missing", { title: "X" })).rejects.toThrow("Item não encontrado");
  });

  it("lança erro sem permissão", async () => {
    const repo = new FakeItemRepository(baseItem);
    await expect(updateItem(repo, "u2", "i1", { title: "X" })).rejects.toThrow("Sem permissão");
  });

  it("adiciona imageUrls ao repositório quando fornecidas", async () => {
    const repo = new FakeItemRepository(baseItem);
    await updateItem(repo, "u1", "i1", { title: "Novo título", imageUrls: ["https://ex.com/a.jpg"] });
    expect(repo.imagesCaptures).toEqual([{ itemId: "i1", urls: ["https://ex.com/a.jpg"] }]);
  });

  it("não chama createImages sem imageUrls", async () => {
    const repo = new FakeItemRepository(baseItem);
    await updateItem(repo, "u1", "i1", { title: "Novo título" });
    expect(repo.imagesCaptures).toEqual([]);
  });
});
// ponytail: o `createItem` recheca o prazo e o piso do lance no use case, e nao
// so no `itemSchema`. O `updateItem` nao rechecava nenhum dos dois: hoje o
// schema cobre o unico caminho de escrita, entao nao ha exploit vivo — mas a
// razao de o `createItem` existir e justamente nao confiar no schema, e um
// `updateItem` sem o par nao seria a segunda porta da mesma regra. Um proximo
// caller (revenda, import) herdaria o buraco. Estes casos travam o par.
describe("updateItem — as mesmas regras que o createItem recheca", () => {
  it("rejeita prazo de lances no passado", async () => {
    const repo = new FakeItemRepository(baseItem);
    await expect(
      updateItem(repo, "u1", "i1", { bidDeadline: new Date(Date.now() - 1000) }),
    ).rejects.toThrow("Prazo de lances deve ser no futuro");
  });

  it("rejeita lance mínimo abaixo de R$ 1,00", async () => {
    const repo = new FakeItemRepository(baseItem);
    await expect(updateItem(repo, "u1", "i1", { minInitialBid: 99 })).rejects.toThrow(
      "Lance mínimo deve ser de pelo menos R$ 1,00",
    );
  });

  it("rejeita incremento abaixo de R$ 1,00", async () => {
    const repo = new FakeItemRepository(baseItem);
    await expect(updateItem(repo, "u1", "i1", { minBidIncrement: 99 })).rejects.toThrow(
      "Lance mínimo deve ser de pelo menos R$ 1,00",
    );
  });

  // ponytail: `UpdateItemInput` e uma atualizacao PARCIAL — todo campo e
  // opcional e `undefined` significa "nao mexer aqui". Se a checagem tratasse
  // `undefined` como invalido, TODO save de um item sem mexer no prazo
  // quebraria, porque o `itemSchema` sempre manda o campo.
  it("aceita um patch que nao mexe no prazo nem no dinheiro", async () => {
    const repo = new FakeItemRepository(baseItem);
    await expect(updateItem(repo, "u1", "i1", { title: "Novo título" })).resolves.toBeTruthy();
  });
});
