import sqlite3 from 'sqlite3';
import { genresMock } from './mockData/genresMock';
import countriesMock from './mockData/countriesMock';
import citiesMock from './mockData/citiesMock';
import movieLanguagesMock from './mockData/movieLanguagesMock';

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

  db.run('DELETE FROM genre;');
  db.run('DELETE FROM country;');
  db.run('DELETE FROM city;');
  db.run('DELETE FROM movie_language;');

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
});

db.close();
