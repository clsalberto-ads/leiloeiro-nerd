"use client";
import { startTransition, useEffect, useState } from "react";
import { getItemBidsAction } from "@/presentation/actions/bid-actions";
import { BidForm } from "@/components/bid-form";
import { BidHistory } from "@/components/bid-history";
import type { Bid } from "@/domain/repositories/bid-repository";

interface BidSectionProps {
  itemId: string;
  initialBids: Bid[];
  minInitialBid: number;
  minBidIncrement: number;
}

export function BidSection({ itemId, initialBids, minInitialBid, minBidIncrement }: BidSectionProps) {
  const [bids, setBids] = useState<Bid[]>(initialBids);

  useEffect(() => {
    const id = setInterval(() => {
      const formData = new FormData();
      formData.set("itemId", itemId);
      startTransition(() => {
        void getItemBidsAction(null, formData).then((res) => {
          if (res.bids) setBids(res.bids);
        });
      });
    }, 10_000);
    return () => clearInterval(id);
  }, [itemId]);

  const minBid = bids.length > 0 ? bids[0].amount + minBidIncrement : minInitialBid;

  return (
    <div className="space-y-4">
      <BidForm key={minBid} itemId={itemId} minBid={minBid} />
      <BidHistory bids={bids} />
    </div>
  );
}