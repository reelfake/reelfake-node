import type { Response } from 'express';
import { literal } from 'sequelize';
import { CartModel, MovieLanguageModel, MovieModel, WishlistModel } from '../models';
import { AppError } from '../utils';
import sequelize from '../sequelize.config';
import { ERROR_MESSAGES } from '../constants';
import { CustomRequest, CustomRequestWithBody } from '../types';

export const getWishlist = async (req: CustomRequest, res: Response) => {
  const { user } = req;

  if (!user) throw new AppError(ERROR_MESSAGES.INVALID_AUTH_TOKEN, 401);

  const customerId = user.id;

  const wishlistForCustomer = await WishlistModel.findAll({
    where: {
      customerId,
    },
    include: [
      {
        model: MovieModel,
        as: 'movie',
        include: [
          {
            model: MovieLanguageModel,
            as: 'movieLanguage',
            attributes: [],
          },
        ],
        attributes: [
          'id',
          'title',
          'runtime',
          'releaseDate',
          [
            literal(
              `(SELECT ARRAY_AGG(g.genre_name) FROM unnest("movie".genre_ids) AS g_ids LEFT OUTER JOIN genre AS g ON g.id = g_ids)`,
            ),
            'genres',
          ],
          [
            literal(
              `(SELECT ARRAY_AGG(c.iso_country_code) FROM unnest("movie".origin_country_ids) as c_ids LEFT OUTER JOIN country AS c ON c.id = c_ids)`,
            ),
            'countriesOfOrigin',
          ],
          [literal('"movie->movieLanguage"."iso_language_code"'), 'language'],
          'popularity',
          'ratingAverage',
          'ratingCount',
          'posterUrl',
          'rentalRate',
        ],
      },
    ],
    attributes: ['id'],
  });

  res.status(200).json({
    items: wishlistForCustomer,
    length: wishlistForCustomer.length,
  });
};

export const addWishlist = async (req: CustomRequestWithBody<{ movieId: number }>, res: Response) => {
  const { user } = req;

  if (!user) throw new AppError(ERROR_MESSAGES.INVALID_AUTH_TOKEN, 401);

  const customerId = user.id;
  const { movieId } = req.body;

  const newWishlist = await sequelize.transaction(async (t) => {
    const existingWishlistCount = await WishlistModel.count({
      where: {
        customerId,
        movieId,
      },
      transaction: t,
    });

    if (existingWishlistCount > 0) {
      throw new AppError('Wishlist already exist for the customer with the given movie', 400);
    }

    const movieInstance = await MovieModel.findByPk(movieId, {
      transaction: t,
      include: [
        {
          model: MovieLanguageModel,
          as: 'movieLanguage',
          attributes: [],
        },
      ],
      attributes: [
        'id',
        'title',
        'runtime',
        'releaseDate',
        [
          literal(
            `(SELECT ARRAY_AGG(g.genre_name) FROM unnest("Movie".genre_ids) AS g_ids LEFT OUTER JOIN genre AS g ON g.id = g_ids)`,
          ),
          'genres',
        ],
        [
          literal(
            `(SELECT ARRAY_AGG(c.iso_country_code) FROM unnest("Movie".origin_country_ids) as c_ids LEFT OUTER JOIN country AS c ON c.id = c_ids)`,
          ),
          'countriesOfOrigin',
        ],
        [literal('"movieLanguage"."iso_language_code"'), 'language'],
        'popularity',
        'ratingAverage',
        'ratingCount',
        'posterUrl',
        'rentalRate',
      ],
    });
    if (movieInstance === null) throw new AppError('Movie not found', 404);

    const wishlistInstance = WishlistModel.build({ customerId, movieId });
    const newWishlist = await wishlistInstance.save({ fields: ['customerId', 'movieId'], transaction: t });

    return {
      id: newWishlist.getDataValue('id'),
      movie: movieInstance.toJSON(),
    };
  });

  res.status(201).json(newWishlist);
};

export const deleteWishlist = async (req: CustomRequest, res: Response) => {
  const { user } = req;
  if (!user) throw new AppError(ERROR_MESSAGES.INVALID_AUTH_TOKEN, 401);

  const wishlistId = req.params.id;

  await sequelize.transaction(async (t) => {
    const wishlistInstance = await WishlistModel.findByPk(wishlistId, { transaction: t });
    if (wishlistInstance === null) {
      throw new AppError('Wishlist not found', 404);
    }

    const customerId = Number(wishlistInstance.getDataValue('customerId'));
    if (customerId !== user.id) throw new AppError(ERROR_MESSAGES.FORBIDDEN, 403);

    await wishlistInstance.destroy({ transaction: t });
  });

  res.status(204).send();
};

export const moveToCart = async (req: CustomRequest, res: Response) => {
  const { user } = req;
  if (!user) throw new AppError(ERROR_MESSAGES.INVALID_AUTH_TOKEN, 401);

  const wishlistId = req.params.id;

  const newCart = await sequelize.transaction(async (t) => {
    const wishlistInstance = await WishlistModel.findByPk(wishlistId, { transaction: t });
    if (wishlistInstance === null) {
      throw new AppError('Wishlist not found', 404);
    }

    const customerId = Number(wishlistInstance.getDataValue('customerId'));
    if (customerId !== user.id) throw new AppError(ERROR_MESSAGES.FORBIDDEN, 403);

    const movieId = Number(wishlistInstance.getDataValue('movieId'));
    const movieInstance = await MovieModel.findByPk(movieId, {
      transaction: t,
      include: [
        {
          model: MovieLanguageModel,
          as: 'movieLanguage',
          attributes: [],
        },
      ],
      attributes: [
        'id',
        'title',
        'runtime',
        'releaseDate',
        [
          literal(
            `(SELECT ARRAY_AGG(g.genre_name) FROM unnest("Movie".genre_ids) AS g_ids LEFT OUTER JOIN genre AS g ON g.id = g_ids)`,
          ),
          'genres',
        ],
        [
          literal(
            `(SELECT ARRAY_AGG(c.iso_country_code) FROM unnest("Movie".origin_country_ids) as c_ids LEFT OUTER JOIN country AS c ON c.id = c_ids)`,
          ),
          'countriesOfOrigin',
        ],
        [literal('"movieLanguage"."iso_language_code"'), 'language'],
        'popularity',
        'ratingAverage',
        'ratingCount',
        'posterUrl',
        'rentalRate',
      ],
    });
    if (movieInstance === null) throw new AppError('Movie not found', 404);

    await wishlistInstance.destroy({ transaction: t });

    const cartInstance = CartModel.build({ customerId, movieId, quantity: 1 });
    const newCart = await cartInstance.save({ fields: ['customerId', 'movieId', 'quantity'], transaction: t });
    return {
      id: newCart.getDataValue('id'),
      quantity: cartInstance.getDataValue('quantity'),
      movie: movieInstance.toJSON(),
    };
  });

  res.status(201).json(newCart);
};
