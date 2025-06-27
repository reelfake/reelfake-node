import { Op, WhereOptions } from 'sequelize';

export function parseFilterRangeQuery<T extends string | number>(
  fieldName: string,
  fieldValue: string | undefined
): WhereOptions | undefined {
  const filterRange: T[] | undefined = fieldValue
    ?.toString()
    .split(',')
    .map<T>((val) => val as T);

  if (filterRange && filterRange.length === 1) {
    return {
      [fieldName]: {
        [Op.eq]: filterRange[0],
      },
    };
  }

  if (filterRange && filterRange.length === 2) {
    const [minValue, maxValue] = filterRange;
    if (minValue && !maxValue) {
      return {
        [fieldName]: {
          [Op.gte]: minValue,
        },
      };
    }

    if (!minValue && maxValue) {
      return {
        [fieldName]: {
          [Op.lte]: maxValue,
        },
      };
    }

    return {
      [fieldName]: {
        [Op.between]: filterRange,
      },
    };
  }

  return undefined;
}

export async function getPaginationOffset(pageNumber: number, limit: number) {
  const idOffset = pageNumber > 0 ? pageNumber * limit - limit + 1 : pageNumber;

  return idOffset;
}

export async function getPaginationOffsetWithFilters(pageNumber: number, limit: number, ids: number[]) {
  let idOffset = Number(ids.at(0));

  const isLastPage = pageNumber === -1 || pageNumber === ids.length / limit;

  if (isLastPage) {
    idOffset = Number(ids.at(-limit));
  }

  if (pageNumber > 1) {
    idOffset = Number(ids.at(pageNumber * limit - limit));
  }

  return idOffset;
}

export function getPaginationMetadata(
  pageNumber: number,
  totalItems: number,
  limitPerPage: number,
  totalPages: number,
  queryString: { [key: string]: string },
  pageFilters: WhereOptions | undefined
) {
  const currentPageNumber = pageNumber > 0 ? pageNumber : totalPages;
  const isLastPage = pageNumber === -1 || totalPages === pageNumber;
  const isFirstPage = pageNumber === 1;

  let nextPage = isLastPage ? null : `?page=${currentPageNumber + 1}`;
  let prevPage = isFirstPage ? null : `?page=${currentPageNumber - 1}`;
  let firstPage = '?page=first';
  let lastPage = '?page=last';

  const keyValueQueries = Object.entries(queryString).reduce<string[]>((acc, curr) => {
    return [...acc, `${curr[0]}=${curr[1]}`];
  }, []);

  if (nextPage && pageFilters) {
    nextPage += `&${keyValueQueries.join('&')}`;
  }

  if (prevPage && pageFilters) {
    prevPage += `&${keyValueQueries.join('&')}`;
  }

  if (pageFilters) {
    firstPage += `&${keyValueQueries.join('&')}`;
    lastPage += `&${keyValueQueries.join('&')}`;
  }

  const pagination = {
    pageNumber: currentPageNumber,
    totalPages,
    totalItems: totalItems,
    itemsPerPage: limitPerPage,
    next: nextPage,
    prev: prevPage,
    first: firstPage,
    last: lastPage,
  };

  return pagination;
}
