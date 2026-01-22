import supertest from 'supertest';
import app from '../app';
import { execQuery, getMultipleCustomerCredentials } from './testUtil';

describe('Wishlist Controller', () => {
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

  const populateWishlist = async (movieIds: number[]) => {
    for (let i = 0; i < movieIds.length; i++) {
      const result = await server
        .post('/api/wishlist')
        .send({
          movieId: movieIds[i],
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
    await execQuery(`DELETE FROM wishlist`);
  });

  it('should get all the wishlist items for the logged in customer', async () => {
    const { email, password } = credentials[0];
    await login(email, password);

    const movieIdsMock = [1, 2, 3];

    await populateWishlist(movieIdsMock);

    const response = await server.get('/api/wishlist').set('Cookie', cookie);
    expect(response.status).toEqual(200);

    const expectedMoviesInWishlist = await execQuery(
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

    const expectedResponse = expectedMoviesInWishlist
      .map((m) => ({
        id: expect.any(Number),
        movie: m,
      }))
      .sort((a, b) => (a.movie as any).id - (b.movie as any).id);

    expect(actualResponse).toEqual(expectedResponse);
  });

  it('should create the wishlist item', async () => {
    const { email, password } = credentials[0];
    await login(email, password);

    const response1 = await server.get('/api/wishlist').set('Cookie', cookie);
    expect(response1.status).toEqual(200);
    expect(response1.body).toEqual({ items: [], length: 0 });

    const movieId = 1;
    await server
      .post('/api/wishlist')
      .send({
        movieId: movieId,
      })
      .set('Cookie', cookie);

    const expectedMovieInWishlist = await execQuery(
      `SELECT m.id, m.title, m.runtime, m.release_date AS "releaseDate",
      (SELECT ARRAY_AGG(g.genre_name) FROM unnest("m".genre_ids) AS g_ids LEFT OUTER JOIN genre AS g ON g.id = g_ids) AS genres,
      (SELECT ARRAY_AGG(c.iso_country_code) FROM unnest("m".origin_country_ids) as c_ids LEFT OUTER JOIN country AS c ON c.id = c_ids) AS "countriesOfOrigin",
      ml.iso_language_code AS language,
      m.popularity, m.rating_average AS "ratingAverage", m.rating_count AS "ratingCount", m.poster_url AS "posterUrl", m.rental_rate AS "rentalRate"
      FROM movie AS m LEFT OUTER JOIN movie_language AS ml ON m.language_id = ml.id WHERE m.id = ${movieId}`,
    );

    const response2 = await server.get('/api/wishlist').set('Cookie', cookie);
    expect(response2.status).toEqual(200);
    expect(response2.body).toEqual({
      items: [
        {
          id: expect.any(Number),
          movie: expectedMovieInWishlist[0],
        },
      ],
      length: 1,
    });
  });

  it('should not create a duplicate wishlist when a wishlist for movie already exist', async () => {
    const { email, password } = credentials[0];
    await login(email, password);

    const response1 = await server.get('/api/wishlist').set('Cookie', cookie);
    expect(response1.status).toEqual(200);
    expect(response1.body).toEqual({ items: [], length: 0 });

    const movieId = 1;
    await server
      .post('/api/wishlist')
      .send({
        movieId: movieId,
      })
      .set('Cookie', cookie);

    const response = await server
      .post('/api/wishlist')
      .send({
        movieId: movieId,
      })
      .set('Cookie', cookie);
    expect(response.status).toEqual(400);
    expect(response.body.message).toEqual('Wishlist already exist for the customer with the given movie');
  });

  it('should delete the wishlist item', async () => {
    const { email, password } = credentials[0];
    await login(email, password);

    const movieIdsMock = [1, 2, 3];

    await populateWishlist(movieIdsMock);

    let response = await server.get('/api/wishlist').set('Cookie', cookie);
    expect(response.status).toEqual(200);

    const wishlistId = response.body.items[0].id;
    await server.delete(`/api/wishlist/${wishlistId}`).set('Cookie', cookie);

    response = await server.get('/api/wishlist').set('Cookie', cookie);
    expect(response.status).toEqual(200);
    expect(response.body.items.find((wishlistItem: any) => wishlistItem.id === wishlistId)).toBeUndefined();
  });

  it('should move the wishlist item to cart', async () => {
    await execQuery(`DELETE FROM cart`);

    const { id: customerId, email, password } = credentials[0];
    await login(email, password);

    const movieIdsMock = [1, 2, 3];

    await populateWishlist(movieIdsMock);

    let response = await server.get('/api/wishlist').set('Cookie', cookie);
    expect(response.status).toEqual(200);

    const cartId = response.body.items[0].id;
    const movieId = response.body.items[0].movie.id;

    const [resultBeforeMove] = await execQuery(
      `SELECT id FROM cart WHERE customer_id = ${customerId} AND movie_id = ${movieId}`,
    );

    expect(resultBeforeMove).toBeUndefined();

    const moveToCartResponse = await server.post(`/api/wishlist/${cartId}/move_to_cart`).set('Cookie', cookie);
    expect(moveToCartResponse.status).toEqual(201);

    const [resultAfterMove] = await execQuery(
      `SELECT id, customer_id AS "customerId", quantity FROM cart WHERE customer_id = ${customerId} AND movie_id = ${movieId}`,
    );

    const [expectedMovieInCart] = await execQuery(
      `SELECT m.id, m.title, m.runtime, m.release_date AS "releaseDate",
      (SELECT ARRAY_AGG(g.genre_name) FROM unnest("m".genre_ids) AS g_ids LEFT OUTER JOIN genre AS g ON g.id = g_ids) AS genres,
      (SELECT ARRAY_AGG(c.iso_country_code) FROM unnest("m".origin_country_ids) as c_ids LEFT OUTER JOIN country AS c ON c.id = c_ids) AS "countriesOfOrigin",
      ml.iso_language_code AS language,
      m.popularity, m.rating_average AS "ratingAverage", m.rating_count AS "ratingCount", m.poster_url AS "posterUrl", m.rental_rate AS "rentalRate"
      FROM movie AS m LEFT OUTER JOIN movie_language AS ml ON m.language_id = ml.id WHERE m.id = ${movieId}`,
    );

    expect(moveToCartResponse.body).toEqual({
      id: expect.any(Number),
      quantity: resultAfterMove['quantity'],
      movie: expectedMovieInCart,
    });

    await execQuery(`DELETE FROM cart`);
  });

  it('should not allow customer to delete wishlist that belongs to other customer', async () => {
    const { email: email1, password: password1 } = credentials[0];
    await login(email1, password1);

    const movieId = 1;
    const response1 = await server
      .post('/api/wishlist')
      .send({
        movieId: movieId,
      })
      .set('Cookie', cookie);
    expect(response1.status).toEqual(201);

    const wishlistIdForCustomer1 = response1.body.id;

    const { email: email2, password: password2 } = credentials[1];
    await login(email2, password2);

    const response = await server.delete(`/api/wishlist/${wishlistIdForCustomer1}`).set('Cookie', cookie);
    expect(response.status).toEqual(403);
    expect(response.body.message).toEqual('You are not authorized to perform this operation');
  });
});
