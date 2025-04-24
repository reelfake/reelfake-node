import { getRandomCharacters, getRandomNumberBetween, execQuery } from './testUtil';

export const actorsDataMock = [
  {
    tmdbId: 12835,
    imdbId: 'nm0004874',
    actorName: 'Vin Diesel',
    biography: `Mark Sinclair (born July 18, 1967), known professionally as Vin Diesel, is an American actor and producer. One of the world's highest-grossing actors, he is best known for playing Dominic Toretto in the Fast & Furious franchise.\n\nDiesel began his career in 1990, but faced difficulty achieving recognition until he wrote, directed and starred in the short film Multi-Facial (1995) and his debut feature Strays (1997); the films prompted Steven Spielberg to cast Diesel in the war epic Saving Private Ryan (1998). Diesel subsequently voiced the titular character in The Iron Giant (1999) and then gained a reputation as an action star after headlining the Fast & Furious, XXX, and The Chronicles of Riddick franchises. He is slated to appear in the upcoming Avatar films.\n\nDiesel voices Groot and Groot II in the Marvel Cinematic Universe (MCU); he portrayed the characters in six superhero films, beginning with Guardians of the Galaxy (2014). Diesel has reprised his role as Groot for the Disney+ animated shorts series I Am Groot (2022-present), the television special The Guardians of the Galaxy Holiday Special (2022), and the animated film Ralph Breaks the Internet (2018). Diesel achieved commercial success in the comedy The Pacifier (2005) and his portrayal of Jackie DiNorscio in Find Me Guilty (2006) was praised.\n\nHe founded the production company One Race Films, where he has also served as a producer or executive producer for his star vehicles. Diesel also founded the record label Racetrack Records and video game developer Tigon Studios, providing his voice and motion capture for all of Tigon's releases.`,
    birthday: '1967-07-18',
    deathday: null,
    placeOfBirth: 'Alameda County, California, USA',
    popularity: 13.6724,
    procilePictureUrl: 'https://image.tmdb.org/t/p/w500/nZdVry7lnUkE24PnXakok9okvL4.jpg',
    characterName: 'Dominic Toretto',
    castOrder: 0,
  },
  {
    tmdbId: 17647,
    imdbId: 'nm0735442',
    actorName: 'Michelle Rodríguez',
    biography: `Mayte Michelle Rodríguez (born July 12, 1978) is an American actress. She began her career in 2000, playing a troubled boxer in the independent sports drama film Girlfight (2000), where she won the Independent Spirit Award and Gotham Award for Best Debut Performance. Rodriguez played Letty Ortiz in the Fast & Furious franchise and Rain Ocampo in the Resident Evil franchise. She has starred in the crime thriller S.W.A.T. (2003), James Cameron's science fiction epic Avatar (2009), and in the action film Battle: Los Angeles (2011).\n\nAfter playing Minerva Mirabal in the biopic Trópico de Sangre (2010), Rodriguez headlined the exploitation films Machete (2010) and Machete Kills (2013) and starred in the animated comedy films Turbo (2013) and Smurfs: The Lost Village(2017), while her performance in the heist film Widows (2018) was critically praised.\n\nOutside of film, Rodriguez played Ana Lucia Cortez in the drama television series Lost (2005-2006; 2009-2010) and voiced Liz Ricarro in the English-language translation of the anime Immortal Grand Prix (2005-2006). She reprised her roles in video game spin-offs of Avatar and Fast & Furious and also appeared in True Crime: Streets of LA (2003), Driver 3 (2004), Halo 2 (2004), and Call of Duty: Black Ops II (2012).\n\nDescription above from the Wikipedia article Michelle Rodriguez, licensed under CC-BY-SA, full list of contributors on Wikipedia.`,
    birthday: '1978-07-12',
    deathday: null,
    placeOfBirth: 'Bexar County, Texas, USA',
    popularity: 3.2954,
    profilePictureUrl: 'https://image.tmdb.org/t/p/w500/xSvkVrLz6xas1mCeOR9i4QtmhnQ.jpg',
    characterName: 'Letty Ortiz',
    castOrder: 1,
  },
  {
    tmdbId: 8169,
    imdbId: 'nm0879085',
    actorName: 'Tyrese Gibson',
    biography: `Tyrese Darnell Gibson (born December 30, 1978) is an American R&B singer and actor from Los Angeles, California. He signed with RCA Records in 1998 and released his debut single, \"Nobody Else\", in August of that year. It peaked within the top 40 of the Billboard Hot 100. It preceded his self-titled debut album (1998), which received platinum certification by the Recording Industry Association of America (RIAA) and spawned his second top 40 single, \"Sweet Lady\".\n\nHis second and third albums, 2000 Watts (2001) and I Wanna Go There (2002), received certifications from the RIAA. The latter was led by the single \"How You Gonna Act Like That\", which peaked at number seven on the Billboard Hot 100 and remains his highest-charting song. His fourth album, Alter Ego (2006), explored hip hop under the pseudonym Black Ty, while his fifth album, Open Invitation (2011), was nominated for Best R&B Album at the 55th Annual Grammy Awards. Gibson's sixth album, Black Rose (2015), debuted atop the Billboard 200.\n\nGibson has sold over 4 million singles and albums in the United States. Gibson had his first starring role in John Singleton's coming-of-age hood film Baby Boy (2001) and gained widespread recognition as Roman Pearce in the Fast & Furious franchise. Gibson reunited with Singleton for the action film Four Brothers (2005) and plays Robert Epps in the Transformers franchise. He appeared in the comedy film Ride Along 2 (2016) and the superhero film Morbius (2022).\n\nDescription above from the Wikipedia article Tyrese Gibson, licensed under CC-BY-SA, full list of contributors on Wikipedia.`,
    birthday: '1978-12-30',
    deathday: null,
    placeOfBirth: '',
    popularity: 2.6281,
    profilePictureUrl: 'https://image.tmdb.org/t/p/w500/jxoy4fbXNKFQtBdK73cLXEz3ufS.jpg',
    characterName: 'Roman Pearce',
    castOrder: 2,
  },
  {
    tmdbId: 4859993,
    imdbId: null,
    actorName: 'Jeremy Parisi',
    biography: '',
    birthday: null,
    deathday: null,
    placeOfBirth: null,
    popularity: 0.0702,
    profilePictureUrl: 'https://image.tmdb.org/t/p/w500',
    characterName: 'Italian (uncredited)',
    castOrder: 51,
  },
  {
    tmdbId: 4501844,
    imdbId: null,
    actorName: 'Reneque Samuels',
    biography: '1955-04-06',
    birthday: null,
    deathday: null,
    placeOfBirth: null,
    popularity: 0.1871,
    profilePictureUrl: 'https://image.tmdb.org/t/p/w500/dq3xFKDWJsQjPffm1bmB3TbMilq.jpg',
    characterName: 'Tuner Party Girl (uncredited)',
    castOrder: 54,
  },
  {
    tmdbId: 2157784,
    imdbId: 'nm9245718',
    actorName: 'Amber Sienna',
    biography: '',
    birthday: '1991-04-07',
    deathday: null,
    placeOfBirth: null,
    popularity: 0.2002,
    profilePictureUrl: 'https://image.tmdb.org/t/p/w500/wRCmhzlWZ019vjSmkISAJbVXxTi.jpg',
    characterName: 'Party Girl (uncredited)',
    castOrder: 55,
  },
  {
    tmdbId: 2157785,
    imdbId: `nm${getRandomCharacters()}`,
    actorName: `${getRandomCharacters(5, true)} ${getRandomCharacters(5, true)}`,
    biography: '',
    birthday: '1991-04-07',
    deathday: null,
    placeOfBirth: null,
    popularity: Number((Math.random() * 10).toFixed(4)),
    profilePictureUrl: 'https://image.tmdb.org/t/p/w500/wRCmhzlWZ019vjSmkISAJbVXxTi.jpg',
    characterName: `${getRandomCharacters(5, true)} ${getRandomCharacters(5, true)}`,
    castOrder: getRandomNumberBetween(100, 200),
  },
];

export const getRandomActors = async (count: number = 3) => {
  const [highestTmdbIdQueryResult] = await execQuery(`
    SELECT MAX(tmdb_id) AS "highestTmdbId" FROM movie
  `);
  const highestTmdbId = highestTmdbIdQueryResult.highestTmdbId;

  const randomActors = Array(count)
    .fill(undefined)
    .map((_, i) => ({
      tmdbId: highestTmdbId + i,
      imdbId: `nm${getRandomCharacters()}`,
      actorName: `${getRandomCharacters(5, true)} ${getRandomCharacters(5, true)}`,
      biography: '',
      birthday: '1991-04-07',
      deathday: null,
      placeOfBirth: null,
      popularity: Number((Math.random() * 10).toFixed(4)),
      profilePictureUrl: `https://image.tmdb.org/t/p/w500/${getRandomCharacters(27, false)}.jpg`,
      characterName: `${getRandomCharacters(5, true)} ${getRandomCharacters(5, true)}`,
      castOrder: getRandomNumberBetween(100, 200),
    }));

  return randomActors;
};

export const getRandomActorData = (tmdbId: number) => {
  return {
    tmdbId,
    imdbId: `nm${getRandomCharacters()}`,
    actorName: `${getRandomCharacters(5, true)} ${getRandomCharacters(5, true)}`,
    biography: '',
    birthday: '1991-04-07',
    deathday: null,
    placeOfBirth: null,
    popularity: Number((Math.random() * 10).toFixed(4)),
    profilePictureUrl: 'https://image.tmdb.org/t/p/w500/wRCmhzlWZ019vjSmkISAJbVXxTi.jpg',
    characterName: `${getRandomCharacters(5, true)} ${getRandomCharacters(5, true)}`,
    castOrder: getRandomNumberBetween(100, 200),
  };
};
