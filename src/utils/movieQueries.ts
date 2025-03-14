import { Op } from 'sequelize';
import { MovieModel } from '../models';

export async function queryMovies(limitPerPage: number, genres: string[] = []) {
  const movies = await MovieModel.findAll({
    limit: limitPerPage,
    where: {
      genres: {
        [Op.contains]: genres,
      },
    },
    order: [['id', 'ASC']],
  });
  return movies;
}

export async function queryMoviesByReleaseDates(limitPerPage: number, from: string, to: string) {
  // const fromDateText = `${from.getFullYear()}-${from.getMonth() + 1}-${from.getDate()}`;
  // const toDateText = `${to.getFullYear()}-${to.getMonth() + 1}-${to.getDate()}`;
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

export async function getMoviesCountByReleaseDates(
  from: string,
  to: string,
  genres: string[] = []
) {
  const moviesCount = await MovieModel.count({
    where: {
      [Op.and]: {
        releaseDate: {
          [Op.between]: [from, to],
        },
        genres: {
          [Op.contains]: genres,
        },
      },
    },
  });
  return moviesCount;
}

export async function queryMoviesCountByYear(year: number, genres: string[] = []) {
  const moviesCount = await MovieModel.count({
    where: {
      releaseDate: {
        [Op.between]: [`${year}-01-01`, `${year}-12-31`],
      },
      genres: {
        [Op.contains]: genres,
      },
    },
  });
  return moviesCount;
}
