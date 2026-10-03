export interface Favorite {
  id: string;
  userId: string;
  itemId: string;
  createdAt: Date;
}

export interface FavoriteRepository {
  toggle(userId: string, itemId: string): Promise<{ favorited: boolean; favorite: Favorite | null }>;
  isFavorite(userId: string, itemId: string): Promise<boolean>;
  listByUser(userId: string): Promise<Favorite[]>;
  countByItem(itemId: string): Promise<number>;
}
