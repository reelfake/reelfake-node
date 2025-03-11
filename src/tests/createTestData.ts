import sqlite3 from 'sqlite3';
import genresMock from './mockData/genresMock';
import countriesMock from './mockData/countriesMock';
import citiesMock from './mockData/citiesMock';
import movieLanguagesMock from './mockData/movieLanguagesMock';
import moviesMock from './mockData/moviesMock';

const moviesMock1 = [
  {
    id: 154220,
    tmdbId: 634528,
    imdbId: 'tt6902332',
    title: 'The Marksman',
    originalTitle: 'The Marksman',
    overview:
      "Jim Hanson's quiet life is suddenly disturbed by two people crossing the US/Mexico border - a woman and her young son - desperate to flee a Mexican cartel. After a shootout leaves the mother dead, Jim becomes the boy's reluctant defender. He embraces his role as Miguel's protector and will stop at nothing to get him to safety, as they go on the run from the relentless assassins.",
    runtime: 108,
    releaseDate: '2021-01-15',
    genres: ['Action', 'Drama', 'Thriller'],
    country: ['United States of America'],
    language: 'English',
    movieStatus: 'Released',
    popularity: 16.783,
    budget: 23000000,
    revenue: 23076711,
    ratingAverage: 6.8,
    ratingCount: 1613,
    posterUrl: 'https://image.tmdb.org/t/p/w500/6vcDalR50RWa309vBH1NLmG2rjQ.jpg',
    rentalRate: 11.0,
    rentalDuration: 3,
  },
];

const db = new sqlite3.Database('src/tests/test_db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS genre (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        genre_name VARCHAR(25) NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );`);

  db.run(`CREATE TABLE IF NOT EXISTS country (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      country_name VARCHAR(60) NOT NULL,
      iso_country_code TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS city (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    city_name VARCHAR(50) NOT NULL,
    state_name VARCHAR(60) NOT NULL,
    country_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`);

  db.run(`CREATE TABLE IF NOT EXISTS movie_language (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    language_name VARCHAR(60) NOT NULL,
    iso_language_code VARCHAR(60) NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS v_movie (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    tmdb_id INTEGER NOT NULL,
    imdb_id VARCHAR(60),
    title VARCHAR(255) NOT NULL,
    original_title VARCHAR(255) NOT NULL,
    overview TEXT NOT NULL,
    runtime SMALLINT NOT NULL,
    release_date DATE NOT NULL,
    genres TEXT NOT NULL,
    country TEXT NOT NULL,
    movie_language VARCHAR(20) NOT NULL,
    movie_status VARCHAR(20) NOT NULL,
    popularity REAL NOT NULL,
    budget BIGINT NOT NULL,
    revenue BIGINT NOT NULL,
    rating_average REAL NOT NULL,
    rating_count INTEGER NOT NULL,
    poster_url VARCHAR(90),
    rental_rate DECIMAL(4,2) NOT NULL,
    rental_duration SMALLINT NOT NULL
  )`);

  db.run('DELETE FROM genre;');
  db.run('DELETE FROM country;');
  db.run('DELETE FROM city;');
  db.run('DELETE FROM movie_language;');
  db.run('DELETE FROM v_movie');

  console.log('Adding rows to genre table...');
  for (const g of genresMock) {
    const dt = new Date().toISOString();
    db.run(
      `INSERT INTO genre (id, genre_name, created_at, updated_at) VALUES (${g.id}, "${g.genreName}", "${dt}", "${dt}")`
    );
  }

  console.log('Adding rows to country table...');
  for (const c of countriesMock) {
    const dt = new Date().toISOString();
    db.run(
      `INSERT INTO country (id, country_name, iso_country_code, created_at, updated_at) VALUES(${c.id},"${c.countryName}","${c.countryCode}","${dt}", "${dt}")`
    );
  }

  console.log('Adding rows to city table...');
  for (const c of citiesMock) {
    const dt = new Date().toISOString();
    db.run(
      `INSERT INTO city (id, city_name, state_name, country_id, created_at, updated_at) VALUES(${c.id}, "${c.cityName}", "${c.stateName}", ${c.countryId},"${dt}", "${dt}")`
    );
  }

  console.log('Adding rows to movie_language table...');
  for (const l of movieLanguagesMock) {
    const dt = new Date().toISOString();
    db.run(
      `INSERT INTO movie_language (id, language_name, iso_language_code, created_at, updated_at) VALUES(${l.id}, "${l.language_name}", "${l.iso_language_code}", "${dt}","${dt}")`
    );
  }

  console.log('Adding rows to movie table...');
  for (const m of moviesMock) {
    db.run(
      `INSERT INTO v_movie (id, tmdb_id, imdb_id, title, original_title, overview, runtime, release_date, genres, country, movie_language, movie_status, popularity, budget, revenue, rating_average, rating_count, poster_url, rental_rate, rental_duration) VALUES (${
        m.id
      }, ${m.tmdbId}, "${m.imdbId}", "${m.title}", "${m.originalTitle}", "${m.overview}", ${
        m.runtime
      }, "${m.releaseDate}", "[${m.genres.join(',')}]", "[${m.country.join(',')}]", "${
        m.language
      }", "${m.movieStatus}", ${m.popularity}, ${m.budget}, ${m.revenue}, ${m.ratingAverage}, ${
        m.ratingCount
      }, "${m.posterUrl}", ${m.rentalRate}, ${m.rentalDuration})`
    );
  }
});

db.close();
