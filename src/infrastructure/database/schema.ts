import { integer, index, pgEnum, pgTable, text, timestamp, uuid, boolean } from "drizzle-orm/pg-core";
import { user as userTable } from "./auth-schema";

export const roleEnum = pgEnum("role", ["seller", "bidder", "both"]);
export const itemTypeEnum = pgEnum("item_type", ["product", "service", "piece"]);
export const itemStatusEnum = pgEnum("item_status", ["draft", "active", "closed", "awaiting_payment", "paid", "cancelled"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "approved", "expired", "cancelled", "refunded"]);
export const notificationTypeEnum = pgEnum("notification_type", ["outbid", "won", "payment_due", "payment_expired", "payment_confirmed"]);

export const items = pgTable("items", {
  id: uuid("id").primaryKey().defaultRandom(),
  sellerId: text("seller_id").notNull().references(() => userTable.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  type: itemTypeEnum("type").notNull(),
  imageUrl: text("image_url"),
  minInitialBid: integer("min_initial_bid").notNull(),
  minBidIncrement: integer("min_bid_increment").notNull(),
  bidDeadline: timestamp("bid_deadline", { withTimezone: true }).notNull(),
  paymentDeadlineDays: integer("payment_deadline_days").notNull().default(3),
  status: itemStatusEnum("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("items_bid_deadline_status_idx").on(t.bidDeadline, t.status)]);

export const bids = pgTable("bids", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: uuid("item_id").notNull().references(() => items.id),
  bidderId: text("bidder_id").notNull().references(() => userTable.id),
  amount: integer("amount").notNull(),
  rank: integer("rank"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("bids_item_id_idx").on(t.itemId)]);

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: uuid("item_id").notNull().references(() => items.id),
  bidderId: text("bidder_id").notNull().references(() => userTable.id),
  bidId: uuid("bid_id").notNull().references(() => bids.id),
  amount: integer("amount").notNull(),
  mpPaymentId: text("mp_payment_id"),
  pixQrCode: text("pix_qr_code"),
  pixQrCodeBase64: text("pix_qr_code_base64"),
  paymentLink: text("payment_link"),
  status: paymentStatusEnum("status").notNull().default("pending"),
  deadline: timestamp("deadline", { withTimezone: true }).notNull(),
  attemptNumber: integer("attempt_number").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("payments_item_id_idx").on(t.itemId), index("payments_status_deadline_idx").on(t.status, t.deadline)]);

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().references(() => userTable.id),
  type: notificationTypeEnum("type").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("notifications_user_id_idx").on(t.userId)]);