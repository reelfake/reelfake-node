import sqlite3 from 'sqlite3';
import { genresMock } from './mockData/genresMock';

const db = new sqlite3.Database('src/tests/test_db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS genre (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        genre_name VARCHAR(25) NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );`);

  db.run('DELETE FROM genre;');

  for (const g of genresMock) {
    db.run(
      `INSERT INTO genre (id, genre_name, created_at, updated_at) VALUES (${g.id}, "${g.genreName}", "${g.createdAt}", "${g.updatedAt}")`
    );
  }
});

db.close();
