import { describe, it, expect } from "vitest";
import { nextRank } from "./drizzle-bid-repository";

describe("drizzleBidRepository", () => {
  it("nextRank = 1 quando não há lance anterior (sem lock, primeiro lance)", () => {
    expect(nextRank(null)).toBe(1);
  });

  it("nextRank = N+1 em relação ao maior lance atual", () => {
    expect(nextRank(1)).toBe(2);
    expect(nextRank(7)).toBe(8);
  });
});