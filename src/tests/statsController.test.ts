import supertest from 'supertest';

import app from '../app';
import { execQuery, getStaffCredential } from './testUtil';

describe('Stats Controller', () => {
  let cookie: string = '';

  const server = supertest(app);

  const login = async (email: string, password: string) => {
    const loginResponse = await server.post('/api/auth/login').send({ email, password });
    cookie = loginResponse.get('Set-Cookie')?.at(0) || '';
  };

  beforeAll(async () => {
    const cred = await getStaffCredential();
    await login(cred.email, cred.password);
  });

  afterAll(() => {
    cookie = '';
  });

  it('should get statistics for the most rented movies', async () => {
    const response = await server.get('/api/stats/most_rented_movies?limit=100').set('Cookie', cookie);
    expect(response.status).toEqual(200);

    const queryResult = await execQuery(`
        SELECT m.id AS "movieId", m.title AS "movieTitle",
        COUNT(r.id) AS "totalRentals"
        FROM rental AS r LEFT JOIN inventory AS i ON r.inventory_id = i.id
        LEFT JOIN movie AS m ON i.movie_id = m.id
        GROUP BY i.movie_id, m.id
        ORDER BY "totalRentals" DESC LIMIT 100;
    `);

    expect(response.body).toEqual({ items: queryResult, length: queryResult.length });
  });

  it('should get statistics for the sales by store', async () => {
    const response = await server.get('/api/stats/sales_by_store?limit=100').set('Cookie', cookie);
    expect(response.status).toEqual(200);

    const queryResult = await execQuery(`
        SELECT i.store_id AS "storeId", staff.first_name AS "firstName",
        staff.last_name AS "lastName", staff.email AS "email", SUM(r.amount_paid) AS revenue
        FROM rental AS r LEFT JOIN inventory AS i ON r.inventory_id = i.id 
        LEFT JOIN store AS s ON i.store_id = s.id
        LEFT JOIN staff AS staff ON s.store_manager_id = staff.id
        GROUP BY i.store_id, staff.id
        ORDER BY revenue DESC
        LIMIT 100;
    `);

    expect(response.body).toEqual({ items: queryResult, length: queryResult.length });
  });

  it('should get statistics for the sales by month', async () => {
    const response = await server.get('/api/stats/sales_by_month?limit=100').set('Cookie', cookie);
    expect(response.status).toEqual(200);

    const queryResult = await execQuery(`
        SELECT TO_CHAR(r.payment_date, 'Mon-YYYY') AS month, 
        COUNT(r.id) AS "totalSales", sUM(r.amount_paid) AS revenue
        FROM rental AS r GROUP BY month ORDER BY month
        LIMIT 100;
    `);

    expect(response.body).toEqual({ items: queryResult, length: queryResult.length });
  });

  it('should get statistics for the sales by city', async () => {
    const response = await server.get('/api/stats/sales_by_city?limit=100').set('Cookie', cookie);
    expect(response.status).toEqual(200);

    const queryResult = await execQuery(`
        SELECT c.id AS "id", c.city_name AS "cityName", c.state_name AS "stateName",
        count(r.id) as "totalSales"
        FROM rental AS r LEFT JOIN inventory AS i ON r.inventory_id = i.id 
        LEFT JOIN store AS s ON i.store_id = s.id 
        LEFT JOIN address AS a ON s.address_id = a.id
        LEFT JOIN city AS c ON a.city_id = c.id 
        GROUP BY c.id ORDER BY "totalSales" DESC
        LIMIT 100;
    `);

    expect(response.body).toEqual({ items: queryResult, length: queryResult.length });
  });
});
