"use server";

import { getSession } from "@/presentation/actions/auth-actions";
import { drizzleBidRepository } from "@/infrastructure/database/repositories/drizzle-bid-repository";
import { drizzleItemRepository } from "@/infrastructure/database/repositories/drizzle-item-repository";
import { formatBRL } from "@/lib/format-brl";

function escapeCsv(s: string) {
  const v = String(s ?? "");
  if (v.includes(",") || v.includes("\"") || v.includes("\n") || v.includes("\r")) {
    return '"' + v.replace(/"/g, '""') + '"';
  }
  return v;
}

export async function exportMyBidsCSVAction() {
  const session = await getSession();
  if (!session) throw new Error("Não autenticado");
  const bids = await drizzleBidRepository.listByBidder(session.user.id, 1000);
  const items = new Map();
  for (const b of bids) {
    const it = await drizzleItemRepository.findById(b.itemId);
    if (it) items.set(it.id, it);
  }
  const lines = ["bidId,itemId,itemTitle,amountCents,amountBRL,rank,createdAt,itemStatus"];
  for (const b of bids) {
    const it = items.get(b.itemId);
    lines.push(
      [
        escapeCsv(b.id),
        escapeCsv(b.itemId),
        escapeCsv(it?.title || ""),
        String(b.amount),
        escapeCsv(formatBRL(b.amount)),
        b.rank == null ? "" : String(b.rank),
        b.createdAt instanceof Date ? b.createdAt.toISOString() : String(b.createdAt),
        escapeCsv(it?.status || ""),
      ].join(","),
    );
  }
  const csv = "\ufeff" + lines.join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=meus-lances.csv",
    },
  });
}

export async function exportMyItemsCSVAction() {
  const session = await getSession();
  if (!session) throw new Error("Não autenticado");
  const items = await drizzleItemRepository.listBySellerId(session.user.id, { limit: 1000 });
  const lines = [
    "id,title,type,status,minInitialBid,minBidIncrement,bidDeadline,paymentDeadlineDays,createdAt,updatedAt",
  ];
  for (const it of items.items) {
    lines.push(
      [
        escapeCsv(it.id),
        escapeCsv(it.title),
        escapeCsv(it.type),
        escapeCsv(it.status),
        String(it.minInitialBid),
        String(it.minBidIncrement),
        it.bidDeadline instanceof Date ? it.bidDeadline.toISOString() : String(it.bidDeadline),
        String(it.paymentDeadlineDays),
        it.createdAt instanceof Date ? it.createdAt.toISOString() : String(it.createdAt),
        it.updatedAt instanceof Date ? it.updatedAt.toISOString() : String(it.updatedAt),
      ].join(","),
    );
  }
  const csv = "\ufeff" + lines.join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=meus-itens.csv",
    },
  });
}
