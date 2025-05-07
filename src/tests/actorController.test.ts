import supertest from 'supertest';

import app from '../app';
import {
  ITEMS_COUNT_PER_PAGE_FOR_TEST,
  execQuery,
  getRowsCount,
  getRandomActors,
  getRandomCharacters,
  FIELD_MAP,
  getStoreManagerCredential,
  getCustomerCredential,
  getStaffCredential,
} from './testUtil';

describe('Actor Controller', () => {
  const email = `test${getRandomCharacters(10)}@example.com`;
  const password = 'test@12345';
  let cookie: string;
  const server = supertest(app);

  const login = async (email: string, password: string) => {
    const loginResponse = await server.post('/api/v1/user/login').send({ email, password });
    cookie = loginResponse.get('Set-Cookie')?.at(0) || '';
  };

  beforeAll(async () => {
    await server.post('/api/v1/user/register').send({
      email,
      password,
    });

    let response = await server.post('/api/v1/user/login').send({
      email,
      password,
    });

    cookie = response.get('Set-Cookie')?.at(0) || '';

    response = await server.patch('/api/v1/user/me').set('Cookie', cookie).send({
      storeManagerId: 2,
    });

    cookie = response.get('Set-Cookie')?.at(0) || '';
  });

  afterAll(async () => {
    await execQuery(`DELETE FROM public.user`);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    cookie = '';
  });

  describe('GET /actors', () => {
    it('should return actors page by page', async () => {
      const startingPage = 1;
      const totalRows = await getRowsCount('actor');

      const iterations = 3;

      for (let i = startingPage; i < iterations + startingPage; i++) {
        const response = await server.get(`/api/v1/actors?pageNumber=${i}`);
        const expectedActors = await execQuery(
          `
            SELECT * FROM actor 
            ORDER BY id ASC 
            LIMIT ${ITEMS_COUNT_PER_PAGE_FOR_TEST} 
            OFFSET ${(i - 1) * ITEMS_COUNT_PER_PAGE_FOR_TEST}
          `,
          FIELD_MAP.actor
        );

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        expect(response.body).toStrictEqual({
          items: expectedActors,
          length: expectedActors.length,
          totalPages: Math.ceil(totalRows / ITEMS_COUNT_PER_PAGE_FOR_TEST),
          totalItems: Number(totalRows),
        });
      }
    });

    it('should return correct actor list when jumping between pages', async () => {
      const totalRows = await getRowsCount('actor');
      const pages = [2, 5, 3];

      for (const page of pages) {
        const response = await server.get(`/api/v1/actors?pageNumber=${page}`);
        const expectedActors = await execQuery(
          `
              SELECT * FROM actor 
              ORDER BY id ASC 
              LIMIT ${ITEMS_COUNT_PER_PAGE_FOR_TEST} 
              OFFSET ${(page - 1) * ITEMS_COUNT_PER_PAGE_FOR_TEST}
            `,
          FIELD_MAP.actor
        );

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        expect(response.body).toStrictEqual({
          items: expectedActors,
          length: expectedActors.length,
          totalPages: Math.ceil(totalRows / ITEMS_COUNT_PER_PAGE_FOR_TEST),
          totalItems: Number(totalRows),
        });
      }
    });

    it('should return 400 when page number is 0', async () => {
      const response = await server.get(`/api/v1/actors?pageNumber=0`);

      expect(response.status).toBe(400);
      expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
      expect(response.body.message).toBe('Page number should be a valid non-zero positive number');
    });

    it('should return 400 when page number is not a number', async () => {
      const response = await server.get(`/api/v1/actors?pageNumber=a`);

      expect(response.status).toBe(400);
      expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
      expect(response.body.message).toBe('Page number should be a valid non-zero positive number');
    });
  });

  describe('GET /actors/:id', () => {
    it('should return actor without the movies', async () => {
      const response = await server.get(`/api/v1/actors/928365`);
      const expectedActor = await execQuery(
        `
          SELECT * FROM actor WHERE id = 928365
        `,
        FIELD_MAP.actor
      );

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
      expect(response.body).toStrictEqual(expectedActor[0]);
    });

    it('should return actor with the movies', async () => {
      const actorId = 928365;

      const response = await server.get(`/api/v1/actors/${actorId}?includeMovies=true`);
      const expectedActor = await execQuery(
        `
          SELECT jsonb_build_object(
          'id', a.id, 'imdbId', a.imdb_id, 'actorName', a.actor_name, 'biography', a.biography, 
          'birthday', a.birthday, 'deathday', a.deathday, 'placeOfBirth', a.place_of_birth,
          'popularity', a.popularity, 'profilePictureUrl', a.profile_picture_url, 'movies', (
              SELECT jsonb_agg(jsonb_build_object('id', m.id, 'title', m.title, 'releaseDate', m.release_date, 
              'genres', (SELECT ARRAY_AGG(g.genre_name) FROM genre AS g JOIN UNNEST(m.genre_ids) AS gid ON g.id = gid), 
              'runtime', m.runtime, 'ratingAverage', m.rating_average, 'ratingCount', m.rating_count, 
              'posterUrl', m.poster_url, 'credit', jsonb_build_object('characterName', ma.character_name, 
              'castOrder', ma.cast_order))) 
              FROM movie_actor AS ma LEFT OUTER JOIN movie AS m ON ma.movie_id = m.id 
              WHERE ma.actor_id = ${actorId}
            )
          ) FROM actor a WHERE a.id = ${actorId};
        `,
        FIELD_MAP.actor
      );

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
      expect(response.body).toStrictEqual(expectedActor[0]['jsonb_build_object']);
    });
  });

  describe('GET /actors/search', () => {
    it('should return list of actors with name containing the given chars', async () => {
      const totalRows = await getRowsCount('actor', "actor_name LIKE '%john%'");

      const pages = [1, 2, 7, 8, 3];

      for (const page of pages) {
        const url = page > 1 ? `/api/v1/actors/search?q=john&pageNumber=${page}` : `/api/v1/actors/search?q=john`;

        const response = await server.get(url);
        const expectedActors = await execQuery(
          `
          SELECT * FROM actor 
          WHERE actor_name like '%john%'
          ORDER BY actor_name ASC
          LIMIT ${ITEMS_COUNT_PER_PAGE_FOR_TEST}
          OFFSET ${(page - 1) * ITEMS_COUNT_PER_PAGE_FOR_TEST}
        `,
          FIELD_MAP.actor
        );

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
        expect(response.body).toStrictEqual({
          items: expectedActors,
          length: expectedActors.length,
          totalItems: totalRows,
          totalPages: Math.ceil(totalRows / ITEMS_COUNT_PER_PAGE_FOR_TEST),
        });
      }
    });

    it('should return list of actors with the given name', async () => {
      const totalRows = await getRowsCount('actor', "actor_name = 'steve smith'");
      const response = await server.get('/api/v1/actors/search?name=steve smith');
      const expectedActors = await execQuery(
        `
          SELECT * FROM actor 
          WHERE actor_name = 'steve smith'
          ORDER BY actor_name ASC 
        `,
        FIELD_MAP.actor
      );

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
      expect(response.body).toStrictEqual({
        items: expectedActors,
        length: expectedActors.length,
        totalItems: totalRows,
        totalPages: Math.ceil(totalRows / ITEMS_COUNT_PER_PAGE_FOR_TEST),
      });
    });

    it('should return 400 when missing the string to search', async () => {
      const response = await server.get(`/api/v1/actors/search?q=   `);
      expect(response.status).toBe(400);
      expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
      expect(response.body.message).toBe('Request is missing the search parameter');
    });

    it('should return 404 when no actors found with the given search string', async () => {
      const response = await server.get(`/api/v1/actors/search?q=blahblahblah`);
      expect(response.status).toBe(404);
      expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
      expect(response.body.message).toBe('Resources not found');
    });
  });

  describe('POST /actors', () => {
    it('should add new actor', async () => {
      const [payload] = await getRandomActors(1);

      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const response = await server
        .post('/api/v1/actors')
        .set('Cookie', cookie)
        .send({
          ...payload,
          characterName: undefined,
          castOrder: undefined,
        });
      expect(response.status).toEqual(201);
      const newActorId = response.body.id;

      const [actorQueryResult] = await execQuery(`
        SELECT id, imdb_id AS "imdbId",
        actor_name AS "actorName", biography, birthday, deathday,
        place_of_birth AS "placeOfBirth", popularity, profile_picture_url AS "profilePictureUrl"
        FROM actor WHERE id = ${newActorId}  
      `);
      expect(response.body).toEqual(actorQueryResult);
    });

    it('should not create actor if there exist an actor with the same name', async () => {
      const [payload1] = await getRandomActors(1);
      const [payload2] = await getRandomActors(1);

      await execQuery(`
        INSERT INTO actor (
          tmdb_id, imdb_id, actor_name, biography, birthday, deathday, 
          place_of_birth, popularity, profile_picture_url
        )
        VALUES (
          ${payload1.tmdbId},
          ${payload1.imdbId ? `'${payload1.imdbId}'` : null},
          '${payload1.actorName}',
          ${payload1.biography ? `'${payload1.biography}'` : null},
          '${payload1.birthday?.toISOString().split('T')[0]}',
          ${payload1.deathday ? `'${payload1.deathday}'` : null},
          ${payload1.placeOfBirth ? `'${payload1.placeOfBirth}'` : null},
          ${payload1.popularity},
          '${payload1.profilePictureUrl}'
        )
      `);

      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const response = await server
        .post('/api/v1/actors')
        .set('Cookie', cookie)
        .send({
          ...payload2,
          actorName: payload1.actorName,
        });
      expect(response.status).toEqual(400);
      expect(response.body.message).toEqual(`Actor with name ${payload1.actorName} already exist`);
    });

    it('should not let staff to create actor', async () => {
      const [payload] = await getRandomActors(1);

      const credential = await getStaffCredential();
      await login(credential.email, credential.password);

      const response = await server
        .post('/api/v1/actors')
        .set('Cookie', cookie)
        .send({
          ...payload,
          characterName: undefined,
          castOrder: undefined,
        });

      expect(response.status).toEqual(403);
      expect(response.body).toEqual({
        status: 'error',
        message: 'You are not authorized to perform this operation',
      });
    });

    it('should not let customer to add new actor', async () => {
      const [payload] = await getRandomActors(1);

      const credential = await getCustomerCredential();
      await login(credential.email, credential.password);

      const response = await server
        .post('/api/v1/actors')
        .set('Cookie', cookie)
        .send({
          ...payload,
          characterName: undefined,
          castOrder: undefined,
        });

      expect(response.status).toEqual(403);
      expect(response.body).toEqual({
        status: 'error',
        message: 'You are not authorized to perform this operation',
      });
    });
  });

  describe('PUT /actors/:id', () => {
    it('should update the actor', async () => {
      const [payload1] = await getRandomActors(1);
      const [payload2] = await getRandomActors(1);

      const [newActorQueryResult] = await execQuery(`
        INSERT INTO actor (
          tmdb_id, imdb_id, actor_name, biography, birthday, deathday, 
          place_of_birth, popularity, profile_picture_url
        )
        VALUES (
          ${payload1.tmdbId},
          ${payload1.imdbId ? `'${payload1.imdbId}'` : null},
          '${payload1.actorName}',
          ${payload1.biography ? `'${payload1.biography}'` : null},
          '${payload1.birthday?.toISOString().split('T')[0]}',
          ${payload1.deathday ? `'${payload1.deathday}'` : null},
          ${payload1.placeOfBirth ? `'${payload1.placeOfBirth}'` : null},
          ${payload1.popularity},
          '${payload1.profilePictureUrl}'
        )
        RETURNING id;
      `);
      const newActorId = newActorQueryResult.id;

      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const response = await server
        .put(`/api/v1/actors/${newActorId}`)
        .set('Cookie', cookie)
        .send({
          ...payload2,
          birthday: payload2.birthday?.toISOString().split('T')[0],
          characterName: undefined,
          castOrder: undefined,
        });
      expect(response.status).toEqual(204);

      const [actorQueryResult] = await execQuery(
        `
        SELECT tmdb_id AS "tmdbId", imdb_id AS "imdbId", actor_name AS "actorName",
        biography, birthday, deathday, place_of_birth AS "placeOfBirth", popularity,
        profile_picture_url AS "profilePictureUrl"
        FROM actor
        WHERE id = ${newActorId}
      `,
        {},
        true,
        false
      );

      expect(actorQueryResult).toEqual({
        tmdbId: payload2.tmdbId,
        imdbId: payload2.imdbId || null,
        actorName: payload2.actorName,
        biography: payload2.biography || '',
        birthday: payload2.birthday?.toISOString().split('T')[0] || null,
        deathday: payload2.deathday ? payload2.deathday : null,
        placeOfBirth: payload2.placeOfBirth || null,
        popularity: payload2.popularity,
        profilePictureUrl: payload2.profilePictureUrl,
      });
    });

    it('should return 404 if the actor with the given id does not exist', async () => {
      const [payload] = await getRandomActors(1);
      const [actorQueryResult] = await execQuery(`SELECT MAX(id) AS id FROM actor`);

      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const response = await server
        .put(`/api/v1/actors/${Number(actorQueryResult.id) + 1}`)
        .set('Cookie', cookie)
        .send(payload);
      expect(response.status).toEqual(404);
      expect(response.body.message).toEqual('Resources not found');
    });

    it('should not let staff to update actor data', async () => {
      const [payload] = await getRandomActors(1);

      const [newActorQueryResult] = await execQuery(`
        INSERT INTO actor (
          tmdb_id, imdb_id, actor_name, biography, birthday, deathday, 
          place_of_birth, popularity, profile_picture_url
        )
        VALUES (
          ${payload.tmdbId},
          ${payload.imdbId ? `'${payload.imdbId}'` : null},
          '${payload.actorName}',
          ${payload.biography ? `'${payload.biography}'` : null},
          '${payload.birthday?.toISOString().split('T')[0]}',
          ${payload.deathday ? `'${payload.deathday}'` : null},
          ${payload.placeOfBirth ? `'${payload.placeOfBirth}'` : null},
          ${payload.popularity},
          '${payload.profilePictureUrl}'
        )
        RETURNING id;
      `);
      const newActorId = newActorQueryResult.id;

      const credential = await getStaffCredential();
      await login(credential.email, credential.password);

      const response = await server
        .put(`/api/v1/actors/${Number(newActorId) + 1}`)
        .set('Cookie', cookie)
        .send({ actorName: 'New Actor Name' });
      expect(response.status).toEqual(403);
      expect(response.body.message).toEqual('You are not authorized to perform this operation');
    });

    it('should not let customer to update actor data', async () => {
      const [payload] = await getRandomActors(1);

      const [newActorQueryResult] = await execQuery(`
        INSERT INTO actor (
          tmdb_id, imdb_id, actor_name, biography, birthday, deathday, 
          place_of_birth, popularity, profile_picture_url
        )
        VALUES (
          ${payload.tmdbId},
          ${payload.imdbId ? `'${payload.imdbId}'` : null},
          '${payload.actorName}',
          ${payload.biography ? `'${payload.biography}'` : null},
          '${payload.birthday?.toISOString().split('T')[0]}',
          ${payload.deathday ? `'${payload.deathday}'` : null},
          ${payload.placeOfBirth ? `'${payload.placeOfBirth}'` : null},
          ${payload.popularity},
          '${payload.profilePictureUrl}'
        )
        RETURNING id;
      `);
      const newActorId = newActorQueryResult.id;

      const credential = await getCustomerCredential();
      await login(credential.email, credential.password);

      const response = await server
        .put(`/api/v1/actors/${Number(newActorId) + 1}`)
        .set('Cookie', cookie)
        .send({ actorName: 'New Actor Name' });
      expect(response.status).toEqual(403);
      expect(response.body.message).toEqual('You are not authorized to perform this operation');
    });
  });

  describe('DELETE /actors/:id', () => {
    it('should delete the actor with the given id', async () => {
      const [payload] = await getRandomActors(1);

      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const newActorResponse = await server.post('/api/v1/actors').set('Cookie', cookie).send(payload);
      const newActorId = Number(newActorResponse.body.id);

      let [actorQueryResult] = await execQuery(`SELECT COUNT(*) AS count FROM actor WHERE id = ${newActorId}`);
      expect(Number(actorQueryResult.count)).toEqual(1);

      const response = await server.delete(`/api/v1/actors/${newActorId}`).set('Cookie', cookie);
      expect(response.status).toEqual(204);

      [actorQueryResult] = await execQuery(`SELECT COUNT(*) AS count FROM actor WHERE id = ${newActorId}`);
      expect(Number(actorQueryResult.count)).toEqual(0);
    });

    it('should return 404 when deleting the actor with the id that does not exist', async () => {
      const [actorQueryResult] = await execQuery(`SELECT MAX(id) AS id FROM actor`);

      const credential = await getStoreManagerCredential();
      await login(credential.email, credential.password);

      const response = await server.delete(`/api/v1/actors/${Number(actorQueryResult.id) + 1}`).set('Cookie', cookie);
      expect(response.status).toEqual(404);
      expect(response.body.message).toEqual('Resources not found');
    });

    it('should not let staff to delete the actor', async () => {
      const [payload] = await getRandomActors(1);

      const storeManagerCredential = await getStoreManagerCredential();
      await login(storeManagerCredential.email, storeManagerCredential.password);

      const newActorResponse = await server.post('/api/v1/actors').set('Cookie', cookie).send(payload);
      const newActorId = Number(newActorResponse.body.id);

      const staffCredential = await getStaffCredential();
      await login(staffCredential.email, staffCredential.password);

      const response = await server.delete(`/api/v1/actors/${newActorId}`).set('Cookie', cookie);
      expect(response.status).toEqual(403);
      expect(response.body).toEqual({
        status: 'error',
        message: 'You are not authorized to perform this operation',
      });
    });

    it('should not let customer to delete the actor', async () => {
      const [payload] = await getRandomActors(1);

      const storeManagerCredential = await getStoreManagerCredential();
      await login(storeManagerCredential.email, storeManagerCredential.password);

      const newActorResponse = await server.post('/api/v1/actors').set('Cookie', cookie).send(payload);
      const newActorId = Number(newActorResponse.body.id);

      const customerCredential = await getCustomerCredential();
      await login(customerCredential.email, customerCredential.password);

      const response = await server.delete(`/api/v1/actors/${newActorId}`).set('Cookie', cookie);
      expect(response.status).toEqual(403);
      expect(response.body).toEqual({
        status: 'error',
        message: 'You are not authorized to perform this operation',
      });
    });
  });
});
