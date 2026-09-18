import { describe, expect, it, vi } from "vitest";
import { placeBid } from "./place-bid";
import type { Bid, BidRepository, CreateBidInput } from "@/domain/repositories/bid-repository";
import type { Item, ItemRepository, ItemStatus, CreateItemInput, UpdateItemInput, ItemImage, ItemListFilter } from "@/domain/repositories/item-repository";
import type { UserProfile, UserRepository, UserRole, UpdateProfileInput } from "@/domain/repositories/user-repository";
import type { NotificationRepository, CreateNotificationInput, Notification, NotificationType } from "@/domain/repositories/notification-repository";

interface ResendClient {
  emails: {
    send: (args: { from: string; to: string; subject: string; html: string }) => Promise<unknown>;
  };
}

const baseItem: Item = {
  id: "item1",
  sellerId: "seller1",
  title: "Action Figure Rara",
  description: "Colecionável lacrado",
  type: "product",
  imageUrl: null,
  minInitialBid: 5000,
  minBidIncrement: 500,
  bidDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  paymentDeadlineDays: 3,
  status: "active",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const baseBidder: UserProfile = {
  id: "bidder1",
  name: "João",
  email: "joao@ex.com",
  phone: null,
  slug: null,
  address: null,
  role: "bidder",
};

const baseSeller: UserProfile = {
  id: "seller1",
  name: "Maria",
  email: "maria@ex.com",
  phone: null,
  slug: "maria-seller",
  address: null,
  role: "seller",
};

const outbidUser: UserProfile = {
  id: "bidder2",
  name: "Carlos",
  email: "carlos@ex.com",
  phone: null,
  slug: null,
  address: null,
  role: "bidder",
};

const existingHighBid: Bid = {
  id: "bid1",
  itemId: "item1",
  bidderId: "bidder2",
  bidderName: "Carlos",
  amount: 6000,
  rank: 1,
  createdAt: new Date(Date.now() - 3600000),
};

class FakeItemRepository implements ItemRepository {
  item: Item;
  constructor(item: Item = baseItem) {
    this.item = item;
  }
  async findById(id: string) {
    return id === this.item.id ? this.item : null;
  }
  async create(_input: CreateItemInput): Promise<Item> {
    throw new Error("não usado");
  }
  async update(_id: string, _input: UpdateItemInput): Promise<Item | null> {
    throw new Error("não usado");
  }
  async findBySellerId(_sellerId: string, _filter?: ItemListFilter): Promise<Item[]> {
    throw new Error("não usado");
  }
  async delete(_id: string): Promise<void> {
    throw new Error("não usado");
  }
  async setStatus(_id: string, _status: ItemStatus): Promise<Item | null> {
    throw new Error("não usado");
  }
  async countBids(_itemId: string): Promise<number> {
    throw new Error("não usado");
  }
  async findImagesByItemId(_itemId: string): Promise<ItemImage[]> {
    throw new Error("não usado");
  }
  async findImageById(_imageId: string): Promise<ItemImage | null> {
    throw new Error("não usado");
  }
  async createImages(_itemId: string, _urls: string[]): Promise<ItemImage[]> {
    throw new Error("não usado");
  }
  async deleteImage(_imageId: string): Promise<void> {
    throw new Error("não usado");
  }
}

class FakeBidRepository implements BidRepository {
  bids: Bid[] = [];
  createdBid: Bid | null = null;
  constructor(bids: Bid[] = []) {
    this.bids = [...bids].sort((a, b) => b.amount - a.amount);
  }
  async findByItemId() {
    return this.bids;
  }
  async createBid(input: CreateBidInput): Promise<Bid> {
    const bid: Bid = {
      id: "new-bid",
      ...input,
      bidderName: "João",
      rank: 1,
      createdAt: new Date(),
    };
    this.createdBid = bid;
    return bid;
  }
}

class FakeUserRepository implements UserRepository {
  userBy: Record<string, UserProfile | null>;
  constructor(users: Record<string, UserProfile | null> = {}) {
    this.userBy = users;
  }
  async findById(userId: string) {
    return this.userBy[userId] ?? null;
  }
  async findBySlug(_slug: string): Promise<{ id: string; name: string; slug: string } | null> {
    throw new Error("não usado");
  }
  async updateProfile(_userId: string, _input: UpdateProfileInput): Promise<UserProfile> {
    throw new Error("não usado");
  }
  async updateRole(_userId: string, _role: UserRole, _slug: string): Promise<UserProfile> {
    throw new Error("não usado");
  }
}

class FakeNotificationRepository implements NotificationRepository {
  created: CreateNotificationInput | null = null;
  async create(input: CreateNotificationInput): Promise<Notification> {
    this.created = input;
    return { id: "notif1", ...input, read: false, createdAt: new Date() };
  }
}

describe("placeBid", () => {
  it("cria lance válido (primeiro lance ≥ minInitialBid)", async () => {
    const itemRepo = new FakeItemRepository();
    const bidRepo = new FakeBidRepository([]);
    const userRepo = new FakeUserRepository({ bidder1: baseBidder, seller1: baseSeller });
    const notifRepo = new FakeNotificationRepository();
    const resend: ResendClient = {
      emails: { send: vi.fn().mockResolvedValue({}) },
    };

    const result = await placeBid(itemRepo, bidRepo, userRepo, notifRepo, resend, "bidder1", "item1", 5000);

    expect(result.bid.amount).toBe(5000);
    expect(result.bid.bidderId).toBe("bidder1");
    expect(result.outbidUserId).toBeUndefined();
    expect(notifRepo.created).toBeNull();
  });

  it("rejeita lance < minInitialBid", async () => {
    const itemRepo = new FakeItemRepository();
    const bidRepo = new FakeBidRepository([]);
    const userRepo = new FakeUserRepository({ bidder1: baseBidder, seller1: baseSeller });
    const notifRepo = new FakeNotificationRepository();
    const resend: ResendClient = {
      emails: { send: vi.fn() },
    };

    await expect(
      placeBid(itemRepo, bidRepo, userRepo, notifRepo, resend, "bidder1", "item1", 4000),
    ).rejects.toThrow("Lance deve ser ≥ R$ 50,00");
  });

  it("cria lance subsequente ≥ maiorLance + minBidIncrement", async () => {
    const itemRepo = new FakeItemRepository();
    const bidRepo = new FakeBidRepository([existingHighBid]);
    const userRepo = new FakeUserRepository({ bidder1: baseBidder, seller1: baseSeller, bidder2: outbidUser });
    const notifRepo = new FakeNotificationRepository();
    const resend: ResendClient = {
      emails: { send: vi.fn().mockResolvedValue({}) },
    };

    const result = await placeBid(itemRepo, bidRepo, userRepo, notifRepo, resend, "bidder1", "item1", 6500);

    expect(result.bid.amount).toBe(6500);
    expect(result.outbidUserId).toBe("bidder2");
    expect(notifRepo.created).toEqual({
      userId: "bidder2",
      type: "outbid",
      title: "Lance superado",
      content: "Seu lance de R$ 60,00 em Action Figure Rara foi superado por R$ 65,00",
    });
  });

  it("rejeita lance < maiorLance + minBidIncrement", async () => {
    const itemRepo = new FakeItemRepository();
    const bidRepo = new FakeBidRepository([existingHighBid]);
    const userRepo = new FakeUserRepository({ bidder1: baseBidder, seller1: baseSeller });
    const notifRepo = new FakeNotificationRepository();
    const resend: ResendClient = {
      emails: { send: vi.fn() },
    };

    await expect(
      placeBid(itemRepo, bidRepo, userRepo, notifRepo, resend, "bidder1", "item1", 6200),
    ).rejects.toThrow("Lance deve ser ≥ R$ 65,00");
  });

  it("rejeita se item status ≠ active", async () => {
    const itemRepo = new FakeItemRepository({ ...baseItem, status: "closed" as ItemStatus });
    const bidRepo = new FakeBidRepository([]);
    const userRepo = new FakeUserRepository({ bidder1: baseBidder, seller1: baseSeller });
    const notifRepo = new FakeNotificationRepository();
    const resend: ResendClient = {
      emails: { send: vi.fn() },
    };

    await expect(
      placeBid(itemRepo, bidRepo, userRepo, notifRepo, resend, "bidder1", "item1", 5000),
    ).rejects.toThrow("Item não está em leilão");
  });

  it("rejeita se deadline passou", async () => {
    const itemRepo = new FakeItemRepository({
      ...baseItem,
      bidDeadline: new Date(Date.now() - 1000),
    });
    const bidRepo = new FakeBidRepository([]);
    const userRepo = new FakeUserRepository({ bidder1: baseBidder, seller1: baseSeller });
    const notifRepo = new FakeNotificationRepository();
    const resend: ResendClient = {
      emails: { send: vi.fn() },
    };

    await expect(
      placeBid(itemRepo, bidRepo, userRepo, notifRepo, resend, "bidder1", "item1", 5000),
    ).rejects.toThrow("Leilão encerrado");
  });

  it("rejeita se bidder === seller", async () => {
    const itemRepo = new FakeItemRepository();
    const bidRepo = new FakeBidRepository([]);
    const userRepo = new FakeUserRepository({ seller1: baseSeller });
    const notifRepo = new FakeNotificationRepository();
    const resend: ResendClient = {
      emails: { send: vi.fn() },
    };

    await expect(
      placeBid(itemRepo, bidRepo, userRepo, notifRepo, resend, "seller1", "item1", 5000),
    ).rejects.toThrow("Você não pode dar lance no próprio item");
  });

  it("rejeita se user role ≠ bidder|both", async () => {
    const otherSeller: UserProfile = {
      id: "seller2",
      name: "Outro Vendedor",
      email: "outro@ex.com",
      phone: null,
      slug: "outro-vendedor",
      address: null,
      role: "seller",
    };
    const itemRepo = new FakeItemRepository();
    const bidRepo = new FakeBidRepository([]);
    const userRepo = new FakeUserRepository({ seller2: otherSeller, seller1: baseSeller });
    const notifRepo = new FakeNotificationRepository();
    const resend: ResendClient = {
      emails: { send: vi.fn() },
    };

    await expect(
      placeBid(itemRepo, bidRepo, userRepo, notifRepo, resend, "seller2", "item1", 5000),
    ).rejects.toThrow("Apenas arrematantes podem dar lances");
  });

  it("rejeita se usuário não existe", async () => {
    const itemRepo = new FakeItemRepository();
    const bidRepo = new FakeBidRepository([]);
    const userRepo = new FakeUserRepository({});
    const notifRepo = new FakeNotificationRepository();
    const resend: ResendClient = {
      emails: { send: vi.fn() },
    };

    await expect(
      placeBid(itemRepo, bidRepo, userRepo, notifRepo, resend, "inexistente", "item1", 5000),
    ).rejects.toThrow("Apenas arrematantes podem dar lances");
  });

  it("rejeita se item não encontrado", async () => {
    const itemRepo = new FakeItemRepository();
    const bidRepo = new FakeBidRepository([]);
    const userRepo = new FakeUserRepository({ bidder1: baseBidder, seller1: baseSeller });
    const notifRepo = new FakeNotificationRepository();
    const resend: ResendClient = {
      emails: { send: vi.fn() },
    };

    await expect(
      placeBid(itemRepo, bidRepo, userRepo, notifRepo, resend, "bidder1", "item-inexistente", 5000),
    ).rejects.toThrow("Item não encontrado");
  });

  it("dispara notificationRepo.create(outbid) quando há outbid", async () => {
    const itemRepo = new FakeItemRepository();
    const bidRepo = new FakeBidRepository([existingHighBid]);
    const userRepo = new FakeUserRepository({ bidder1: baseBidder, seller1: baseSeller, bidder2: outbidUser });
    const notifRepo = new FakeNotificationRepository();
    const resend: ResendClient = {
      emails: { send: vi.fn().mockResolvedValue({}) },
    };

    await placeBid(itemRepo, bidRepo, userRepo, notifRepo, resend, "bidder1", "item1", 6500);

    expect(notifRepo.created).not.toBeNull();
    expect(notifRepo.created?.type).toBe("outbid");
    expect(notifRepo.created?.userId).toBe("bidder2");
  });

  it("tenta enviar email Resend (best effort) quando há outbid", async () => {
    const sendMock = vi.fn().mockResolvedValue({});
    const itemRepo = new FakeItemRepository();
    const bidRepo = new FakeBidRepository([existingHighBid]);
    const userRepo = new FakeUserRepository({ bidder1: baseBidder, seller1: baseSeller, bidder2: outbidUser });
    const notifRepo = new FakeNotificationRepository();
    const resend: ResendClient = {
      emails: { send: sendMock },
    };

    await placeBid(itemRepo, bidRepo, userRepo, notifRepo, resend, "bidder1", "item1", 6500);

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Leiloeiro Nerd <noreply@leiloeironerd.com>",
        to: "carlos@ex.com",
        subject: "Seu lance foi superado!",
        html: expect.stringContaining("R$ 60,00"),
      }),
    );
  });

  it("não falha o lance se Resend der erro (best effort)", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const sendMock = vi.fn().mockRejectedValue(new Error("Resend falhou"));
    const itemRepo = new FakeItemRepository();
    const bidRepo = new FakeBidRepository([existingHighBid]);
    const userRepo = new FakeUserRepository({ bidder1: baseBidder, seller1: baseSeller, bidder2: outbidUser });
    const notifRepo = new FakeNotificationRepository();
    const resend: ResendClient = {
      emails: { send: sendMock },
    };

    const result = await placeBid(itemRepo, bidRepo, userRepo, notifRepo, resend, "bidder1", "item1", 6500);

    expect(result.bid.amount).toBe(6500);
    expect(consoleErrorSpy).toHaveBeenCalledWith("[Resend] falha ao enviar outbid:", expect.any(Error));
    consoleErrorSpy.mockRestore();
  });

  it("não envia outbid notification quando o próprio usuário supera seu próprio lance", async () => {
    const existingOwnBid: Bid = { ...existingHighBid, bidderId: "bidder1", bidderName: "João" };
    const itemRepo = new FakeItemRepository();
    const bidRepo = new FakeBidRepository([existingOwnBid]);
    const userRepo = new FakeUserRepository({ bidder1: baseBidder, seller1: baseSeller });
    const notifRepo = new FakeNotificationRepository();
    const resend: ResendClient = {
      emails: { send: vi.fn().mockResolvedValue({}) },
    };

    const result = await placeBid(itemRepo, bidRepo, userRepo, notifRepo, resend, "bidder1", "item1", 7000);

    expect(result.outbidUserId).toBeUndefined();
    expect(notifRepo.created).toBeNull();
  });

  it("usa slug do seller no link do email", async () => {
    const sendMock = vi.fn().mockResolvedValue({});
    const itemRepo = new FakeItemRepository({ ...baseItem, sellerId: "seller1" });
    const bidRepo = new FakeBidRepository([existingHighBid]);
    const userRepo = new FakeUserRepository({ bidder1: baseBidder, seller1: baseSeller, bidder2: outbidUser });
    const notifRepo = new FakeNotificationRepository();
    const resend: ResendClient = {
      emails: { send: sendMock },
    };

    await placeBid(itemRepo, bidRepo, userRepo, notifRepo, resend, "bidder1", "item1", 6500);

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining("/maria-seller/item1"),
      }),
    );
  });
});