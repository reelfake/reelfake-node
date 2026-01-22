import supertest from 'supertest';
import app from '../app';
import { execQuery, getMultipleCustomerCredentials } from './testUtil';

describe('Cart Controller', () => {
  let cookie: string = '';
  const credentials: { id: number; email: string; password: string }[] = [];
  const server = supertest(app);

  const login = async (email: string, password: string) => {
    let loginResponse = await server.post('/api/auth/login').send({ email, password });
    cookie = loginResponse.get('Set-Cookie')?.at(0) || '';
    if (!cookie || loginResponse.status !== 200) {
      loginResponse = await server.post('/api/auth/login').send({ email, password });
      cookie = loginResponse.get('Set-Cookie')?.at(0) || '';
    }

    if (loginResponse.status !== 200) {
      throw new Error(`Login failed for ${email}`);
    }
  };

  const populateCart = async (movieIds: number[]) => {
    for (let i = 0; i < movieIds.length; i++) {
      const result = await server
        .post('/api/cart')
        .send({
          movieId: movieIds[i],
          quantity: Math.round(Math.random() * 10) + 1,
        })
        .set('Cookie', cookie);
      expect(result.status).toEqual(201);
    }
  };

  beforeAll(async () => {
    const result = await getMultipleCustomerCredentials(2);
    credentials.push(...result);
  });

  afterAll(async () => {
    await server.get('/api/auth/logout');
    cookie = '';
  });

  afterEach(async () => {
    await execQuery(`DELETE FROM cart`);
  });

  it('should get all the cart items for the logged in customer', async () => {
    const { email, password } = credentials[0];
    await login(email, password);

    const movieIdsMock = [1, 2, 3];

    await populateCart(movieIdsMock);

    const response = await server.get('/api/cart').set('Cookie', cookie);
    expect(response.status).toEqual(200);

    const expectedMoviesInCart = await execQuery(
      `SELECT m.id, m.title, m.runtime, m.release_date AS "releaseDate",
      (SELECT ARRAY_AGG(g.genre_name) FROM unnest("m".genre_ids) AS g_ids LEFT OUTER JOIN genre AS g ON g.id = g_ids) AS genres,
      (SELECT ARRAY_AGG(c.iso_country_code) FROM unnest("m".origin_country_ids) as c_ids LEFT OUTER JOIN country AS c ON c.id = c_ids) AS "countriesOfOrigin",
      ml.iso_language_code AS language,
      m.popularity, m.rating_average AS "ratingAverage", m.rating_count AS "ratingCount", m.poster_url AS "posterUrl", m.rental_rate AS "rentalRate"
      FROM movie AS m LEFT OUTER JOIN movie_language AS ml ON m.language_id = ml.id WHERE m.id IN (${movieIdsMock.join(',')})`,
    );

    const actualResponse = response.body.items.sort((a: any, b: any) => {
      return (a.movie as any).id - (b.movie as any).id;
    });

    const expectedResponse = expectedMoviesInCart
      .map((m) => ({
        id: expect.any(Number),
        quantity: expect.any(Number),
        movie: m,
      }))
      .sort((a, b) => (a.movie as any).id - (b.movie as any).id);

    expect({
      items: actualResponse,
      length: actualResponse.length,
    }).toEqual({
      items: expectedResponse,
      length: expectedResponse.length,
    });
  });

  it('should create the cart item', async () => {
    const { email, password } = credentials[0];
    await login(email, password);

    const response1 = await server.get('/api/cart').set('Cookie', cookie);
    expect(response1.status).toEqual(200);
    expect(response1.body).toEqual({ items: [], length: 0 });

    const movieId = 1;
    await server
      .post('/api/cart')
      .send({
        movieId: movieId,
        quantity: 2,
      })
      .set('Cookie', cookie);

    const expectedMovieInCart = await execQuery(
      `SELECT m.id, m.title, m.runtime, m.release_date AS "releaseDate",
      (SELECT ARRAY_AGG(g.genre_name) FROM unnest("m".genre_ids) AS g_ids LEFT OUTER JOIN genre AS g ON g.id = g_ids) AS genres,
      (SELECT ARRAY_AGG(c.iso_country_code) FROM unnest("m".origin_country_ids) as c_ids LEFT OUTER JOIN country AS c ON c.id = c_ids) AS "countriesOfOrigin",
      ml.iso_language_code AS language,
      m.popularity, m.rating_average AS "ratingAverage", m.rating_count AS "ratingCount", m.poster_url AS "posterUrl", m.rental_rate AS "rentalRate"
      FROM movie AS m LEFT OUTER JOIN movie_language AS ml ON m.language_id = ml.id WHERE m.id = ${movieId}`,
    );

    const response2 = await server.get('/api/cart').set('Cookie', cookie);
    expect(response2.status).toEqual(200);
    expect(response2.body).toEqual({
      items: [
        {
          id: expect.any(Number),
          quantity: 2,
          movie: expectedMovieInCart[0],
        },
      ],
      length: 1,
    });
  });

  it('should create cart with the default quantity if not provided', async () => {
    const { email, password } = credentials[0];
    await login(email, password);

    const response1 = await server.get('/api/cart').set('Cookie', cookie);
    expect(response1.status).toEqual(200);
    expect(response1.body).toEqual({ items: [], length: 0 });

    const movieId = 1;
    await server
      .post('/api/cart')
      .send({
        movieId: movieId,
      })
      .set('Cookie', cookie);

    const expectedMovieInCart = await execQuery(
      `SELECT m.id, m.title, m.runtime, m.release_date AS "releaseDate",
      (SELECT ARRAY_AGG(g.genre_name) FROM unnest("m".genre_ids) AS g_ids LEFT OUTER JOIN genre AS g ON g.id = g_ids) AS genres,
      (SELECT ARRAY_AGG(c.iso_country_code) FROM unnest("m".origin_country_ids) as c_ids LEFT OUTER JOIN country AS c ON c.id = c_ids) AS "countriesOfOrigin",
      ml.iso_language_code AS language,
      m.popularity, m.rating_average AS "ratingAverage", m.rating_count AS "ratingCount", m.poster_url AS "posterUrl", m.rental_rate AS "rentalRate"
      FROM movie AS m LEFT OUTER JOIN movie_language AS ml ON m.language_id = ml.id WHERE m.id = ${movieId}`,
    );

    const response2 = await server.get('/api/cart').set('Cookie', cookie);
    expect(response2.status).toEqual(200);
    expect(response2.body).toEqual({
      items: [
        {
          id: expect.any(Number),
          quantity: 1,
          movie: expectedMovieInCart[0],
        },
      ],
      length: 1,
    });
  });

  it('should not create a duplicate cart when a cart for movie already exist', async () => {
    const { email, password } = credentials[0];
    await login(email, password);

    const response1 = await server.get('/api/cart').set('Cookie', cookie);
    expect(response1.status).toEqual(200);
    expect(response1.body).toEqual({ items: [], length: 0 });

    const movieId = 1;
    await server
      .post('/api/cart')
      .send({
        movieId: movieId,
        quantity: 2,
      })
      .set('Cookie', cookie);

    const response = await server
      .post('/api/cart')
      .send({
        movieId: movieId,
        quantity: 2,
      })
      .set('Cookie', cookie);
    expect(response.status).toEqual(400);
    expect(response.body.message).toEqual('Cart already exist for the movie');
  });

  it('should update the quantity for the cart item', async () => {
    const { email, password } = credentials[0];
    await login(email, password);

    const movieId = 1;
    const response1 = await server
      .post('/api/cart')
      .send({
        movieId: movieId,
        quantity: 2,
      })
      .set('Cookie', cookie);
    expect(response1.status).toEqual(201);

    const cartId = response1.body.id;

    const [result1] = await execQuery(`SELECT quantity FROM cart WHERE id = ${cartId}`);
    expect(result1.quantity).toEqual(2);

    const response2 = await server.put(`/api/cart/${cartId}`).send({ quantity: 11 }).set('Cookie', cookie);
    expect(response2.status).toEqual(204);
    expect(response2.body).toEqual({});

    const [result2] = await execQuery(`SELECT quantity FROM cart WHERE id = ${cartId}`);
    expect(result2.quantity).toEqual(11);
  });

  it('should delete the cart item', async () => {
    const { email, password } = credentials[0];
    await login(email, password);

    const movieIdsMock = [1, 2, 3];

    await populateCart(movieIdsMock);

    let response = await server.get('/api/cart').set('Cookie', cookie);
    expect(response.status).toEqual(200);

    const cartId = response.body.items[0].id;

    await server.delete(`/api/cart/${cartId}`).set('Cookie', cookie);

    response = await server.get('/api/cart').set('Cookie', cookie);
    expect(response.status).toEqual(200);
    expect(response.body.items.find((cartItem: any) => cartItem.id === cartId)).toBeUndefined();
  });

  it('should move the cart item to wishlist', async () => {
    await execQuery(`DELETE FROM wishlist`);

    const { id: customerId, email, password } = credentials[0];
    await login(email, password);

    const movieIdsMock = [1, 2, 3];

    await populateCart(movieIdsMock);

    let response = await server.get('/api/cart').set('Cookie', cookie);
    expect(response.status).toEqual(200);

    const cartId = response.body.items[0].id;
    const movieId = response.body.items[0].movie.id;

    const [resultBeforeMove] = await execQuery(
      `SELECT id FROM wishlist WHERE customer_id = ${customerId} AND movie_id = ${movieId}`,
    );

    expect(resultBeforeMove).toBeUndefined();

    const moveToWishlistResponse = await server.post(`/api/cart/${cartId}/move_to_wishlist`).set('Cookie', cookie);
    expect(moveToWishlistResponse.status).toEqual(201);

    const [resultAfterMove] = await execQuery(
      `SELECT id, customer_id AS "customerId" FROM wishlist WHERE customer_id = ${customerId} AND movie_id = ${movieId}`,
    );

    const [expectedMovieInCart] = await execQuery(
      `SELECT m.id, m.title, m.runtime, m.release_date AS "releaseDate",
      (SELECT ARRAY_AGG(g.genre_name) FROM unnest("m".genre_ids) AS g_ids LEFT OUTER JOIN genre AS g ON g.id = g_ids) AS genres,
      (SELECT ARRAY_AGG(c.iso_country_code) FROM unnest("m".origin_country_ids) as c_ids LEFT OUTER JOIN country AS c ON c.id = c_ids) AS "countriesOfOrigin",
      ml.iso_language_code AS language,
      m.popularity, m.rating_average AS "ratingAverage", m.rating_count AS "ratingCount", m.poster_url AS "posterUrl", m.rental_rate AS "rentalRate"
      FROM movie AS m LEFT OUTER JOIN movie_language AS ml ON m.language_id = ml.id WHERE m.id = ${movieId}`,
    );

    expect(moveToWishlistResponse.body).toEqual({
      id: resultAfterMove['id'],
      movie: expectedMovieInCart,
    });

    await execQuery(`DELETE FROM wishlist`);
  });

  it('should not allow customer to update cart that belongs to other customer', async () => {
    const { email: email1, password: password1 } = credentials[0];
    await login(email1, password1);

    const movieId = 1;
    const response1 = await server
      .post('/api/cart')
      .send({
        movieId: movieId,
        quantity: 2,
      })
      .set('Cookie', cookie);
    expect(response1.status).toEqual(201);

    const cartIdForCustomer1 = response1.body.id;

    const { email: email2, password: password2 } = credentials[1];
    await login(email2, password2);

    const response = await server.put(`/api/cart/${cartIdForCustomer1}`).send({ quantity: 5 }).set('Cookie', cookie);
    expect(response.status).toEqual(403);
    expect(response.body.message).toEqual('You are not authorized to perform this operation');
  });

  it('should not allow customer to delete cart that belongs to other customer', async () => {
    const { email: email1, password: password1 } = credentials[0];
    await login(email1, password1);

    const movieId = 1;
    const response1 = await server
      .post('/api/cart')
      .send({
        movieId: movieId,
        quantity: 2,
      })
      .set('Cookie', cookie);
    expect(response1.status).toEqual(201);

    const cartIdForCustomer1 = response1.body.id;

    const { email: email2, password: password2 } = credentials[1];
    await login(email2, password2);

    const response = await server.delete(`/api/cart/${cartIdForCustomer1}`).set('Cookie', cookie);
    expect(response.status).toEqual(403);
    expect(response.body.message).toEqual('You are not authorized to perform this operation');
  });
});
