import type { Response } from 'express';
import { literal } from 'sequelize';
import { MovieLanguageModel, MovieModel, CartModel, WishlistModel } from '../models';
import { AppError } from '../utils';
import sequelize from '../sequelize.config';
import { ERROR_MESSAGES, USER_ROLES } from '../constants';
import { CustomRequest, CustomRequestWithBody } from '../types';

export const getCart = async (req: CustomRequest, res: Response) => {
  const { user } = req;

  if (!user) throw new AppError(ERROR_MESSAGES.INVALID_AUTH_TOKEN, 401);

  const customerId = user.id;

  const cartForCustomer = await CartModel.findAll({
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
    attributes: ['id', 'quantity'],
  });

  res.status(200).json({ items: cartForCustomer, length: cartForCustomer.length });
};

export const addCart = async (req: CustomRequestWithBody<{ movieId: number; quantity: number }>, res: Response) => {
  const { user } = req;
  if (!user) throw new AppError(ERROR_MESSAGES.INVALID_AUTH_TOKEN, 401);

  const customerId = user.id;
  const { movieId, quantity = 1 } = req.body;

  const newCart = await sequelize.transaction(async (t) => {
    const existingCartCount = await CartModel.count({
      where: {
        customerId,
        movieId,
      },
      transaction: t,
    });
    if (existingCartCount > 0) {
      throw new AppError('Cart already exist for the movie', 400);
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

    const cartInstance = CartModel.build({ customerId, movieId, quantity });
    const newCart = await cartInstance.save({ fields: ['customerId', 'movieId', 'quantity'], transaction: t });

    return {
      id: newCart.getDataValue('id'),
      quantity: newCart.getDataValue('quantity'),
      movie: movieInstance.toJSON(),
    };
  });

  res.status(201).json(newCart);
};

export const updateCartItemCount = async (req: CustomRequestWithBody<{ quantity: number }>, res: Response) => {
  const { user } = req;
  if (!user) throw new AppError(ERROR_MESSAGES.INVALID_AUTH_TOKEN, 401);

  const cartId = req.params.id;

  const { quantity } = req.body;

  await sequelize.transaction(async (t) => {
    const cartInstance = await CartModel.findByPk(cartId, { transaction: t });
    if (cartInstance === null) {
      throw new AppError('Cart not found', 404);
    }

    const customerId = Number(cartInstance.getDataValue('customerId'));

    if (customerId !== user.id) {
      throw new AppError(ERROR_MESSAGES.FORBIDDEN, 403);
    }

    await cartInstance.update({
      quantity,
    });

    await cartInstance.save({ transaction: t });
  });

  res.status(204).send();
};

export const deleteCart = async (req: CustomRequest, res: Response) => {
  const { user } = req;
  if (!user) throw new AppError(ERROR_MESSAGES.INVALID_AUTH_TOKEN, 401);

  const cartId = req.params.id;

  await sequelize.transaction(async (t) => {
    const cartInstance = await CartModel.findByPk(cartId, { transaction: t });
    if (cartInstance === null) {
      throw new AppError('Cart not found', 404);
    }

    const customerId = Number(cartInstance.getDataValue('customerId'));
    if (customerId !== user.id) throw new AppError(ERROR_MESSAGES.FORBIDDEN, 403);

    await cartInstance.destroy({ transaction: t });
  });

  res.status(204).send();
};

export const moveToWishlist = async (req: CustomRequest, res: Response) => {
  const { user } = req;
  if (!user) throw new AppError(ERROR_MESSAGES.INVALID_AUTH_TOKEN, 401);

  const cartId = req.params.id;
  const newWishlist = await sequelize.transaction(async (t) => {
    const cartInstance = await CartModel.findByPk(cartId, { transaction: t });
    if (cartInstance === null) {
      throw new AppError('Cart not found', 404);
    }
    const customerId = Number(cartInstance.getDataValue('customerId'));
    if (customerId !== user.id) throw new AppError(ERROR_MESSAGES.FORBIDDEN, 403);

    const movieId = Number(cartInstance.getDataValue('movieId'));
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

    await cartInstance.destroy({ transaction: t });

    const wishlistInstance = WishlistModel.build({ customerId, movieId });
    const newWishlist = await wishlistInstance.save({
      fields: ['customerId', 'movieId'],
      returning: ['id'],
      transaction: t,
    });

    return {
      id: newWishlist.getDataValue('id'),
      movie: movieInstance.toJSON(),
    };
  });

  res.status(201).json(newWishlist);
};
