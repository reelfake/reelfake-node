import { QueryTypes, Sequelize, Op, and, WhereOptions } from 'sequelize';
import { MovieModel } from '../models';

export async function queryMovies(limitPerPage: number) {
  const movies = await MovieModel.findAll({
    limit: limitPerPage,
    order: [['id', 'ASC']],
  });
  return movies;
}

export async function queryMovies1(
  limitPerPage: number,
  where: WhereOptions,
  order: [string, string][]
) {
  const movies = await MovieModel.findAll({
    limit: limitPerPage,
    where,
    order,
  });
  return movies;
}

export async function queryMoviesByReleaseDates(limitPerPage: number, from: Date, to: Date) {
  const movies = await MovieModel.findAll({
    limit: limitPerPage,
    where: {
      releaseDate: {
        [Op.between]: [from, to],
      },
    },
    order: [
      ['releaseDate', 'ASC'],
      ['id', 'ASC'],
    ],
  });

  return movies;
}

export async function queryMoviesCountByYear(year: number) {
  const releaseDateFrom = new Date(year, 0, 1);
  const releaseDateTo = new Date(year, 11, 31);
  const moviesCount = await MovieModel.count({
    where: {
      releaseDate: {
        [Op.between]: [releaseDateFrom, releaseDateTo],
      },
    },
  });
  return moviesCount;
}

export async function queryMoviesByYear(
  year: number,
  pageNumber: number,
  limitPerPage: number,
  offsetReleaseDate: string,
  idOffset: number
) {
  const releaseDateFrom = new Date(year, 0, 1);
  const releaseDateTo = new Date(year, 11, 31);

  if (pageNumber === 1) {
    const moviesFirstPage = await queryMoviesByReleaseDates(
      limitPerPage,
      releaseDateFrom,
      releaseDateTo
    );
    return moviesFirstPage;
  }

  const movies = await MovieModel.findAll({
    limit: limitPerPage,
    where: {
      [Op.and]: [
        {
          releaseDate: {
            [Op.between]: [offsetReleaseDate, releaseDateTo],
          },
        },
        {
          id: {
            [Op.gt]: idOffset,
          },
        },
      ],
    },
    order: [
      ['releaseDate', 'ASC'],
      ['id', 'ASC'],
    ],
  });

  return movies;
}

export async function queryMoviesPage(pageNumber: number, limitPerPage: number, idOffset: number) {
  if (pageNumber === 1) {
    return await queryMovies(limitPerPage);
  }

  const movies = await MovieModel.findAll({
    limit: limitPerPage,
    where: {
      id: {
        [Op.gte]: idOffset,
      },
    },
    order: [['id', 'ASC']],
  });
  return movies;
}
