/** A chainable TypeORM query builder mock for the entry query and lookup specs. */
export function createQueryBuilder(overrides: Record<string, unknown> = {}) {
  const qb: Record<string, jest.Mock> = {
    addOrderBy: jest.fn(() => qb),
    addSelect: jest.fn(() => qb),
    andWhere: jest.fn(() => qb),
    getCount: jest.fn(),
    getMany: jest.fn(),
    getOne: jest.fn(),
    getRawAndEntities: jest.fn(),
    getRawMany: jest.fn(),
    getRawOne: jest.fn(),
    leftJoinAndSelect: jest.fn(() => qb),
    limit: jest.fn(() => qb),
    orderBy: jest.fn(() => qb),
    select: jest.fn(() => qb),
    setParameter: jest.fn(() => qb),
    skip: jest.fn(() => qb),
    take: jest.fn(() => qb),
    where: jest.fn(() => qb),
  };

  Object.assign(qb, overrides);
  return qb;
}
