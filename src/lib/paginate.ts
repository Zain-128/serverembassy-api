export type PaginationQuery = { page?: number; limit?: number };

export function paginate(query: PaginationQuery, defaultLimit = 50, maxLimit = 100) {
  const page = Math.max(1, Math.floor(query.page ?? 1));
  const limit = Math.min(maxLimit, Math.max(1, Math.floor(query.limit ?? defaultLimit)));
  return { page, limit, skip: (page - 1) * limit };
}

export function totalPagesOf(total: number, limit: number) {
  return Math.max(1, Math.ceil(total / limit));
}