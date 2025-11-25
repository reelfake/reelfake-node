# Reelfake REST API

## DISCLAIMER

1. The movies, actors, genres and movie languages are taken from the [The Movie Database (TMDB) API](https://developer.themoviedb.org/docs/getting-started). You must adhere to the [terms and agreements](https://www.themoviedb.org/api-terms-of-use?language=en-US) of their api which is modified and added new tables to better suit my needs.
2. The db schema is inspired from the [PostgreSQL Sample Database by NEON](https://neon.com/postgresql/postgresql-getting-started/postgresql-sample-database).
3. Please make sure to adhere to the licensing terms of TMDB API and do not use the reelfake api for commercial purpose. This api is only for knowledge, practice and educational purposes.

# Table of Contents

1. [Introduction](#introduction)
2. [API Specs](#api-specification)
3. [How to access the apis?](#how-to-access-the-apis)
4. [Running locally](#running-on-localhost)<br>
   a. [Start database](#start-the-container-for-database)<br>
   b. [Start api](#start-the-container-for-the-api)<br>
5. [Running on Cloud](#running-on-cloud)<br>
   a. [Start database instance](#instance-for-database)<br>
   b. [Start api instance](#instance-for-api)<br>
6. [Using the api](#using-the-api)<br>
   a. [Base url](#base-url)<br>
   b. [Protected and Unprotected Routes](#protected-and-unprotected-routes)<br>
   c. [Using customer / staff / store manager for login](#using-customer-staff-store-manager-for-login)
7. [Examples](#examples)<br>
   a. [Forgot Password](#forgot-password)<br>
   b. [Login](#login)<br>
   c. [Add Movie](#add-movie)<br>
   d. [Add Movie with Actors](#add-movie-with-actors)<br>
8. [Generating JWT Secret](#generating-jwt-secret)

## Introduction

A rest api that provides data for practicing, prototyping or anything to play with for the frontend development. This api is build with the real sql database so when you update the data is really updated and when you create the data is really created.

#### Reelfake api provides a set of features such as
* Real time CRUD operations. What you update, delete or create persist and you get the updated data on fetch.
* Pagination. The GET methods for some resources like movie, actor and customer implements a pagination feature. Refer the api specs for more information.
* Cookie based authentication. There are some operations which requires you to login.
* Role based authorization. Some resources has a role-based access. For instance, only store manager can add a movie, delete a customer, etc.
* File upload. The movie api provides a capability to let you send a csv file with the movie records for bulk create.
* Server sent events. The movie api implements the SSE (Server-Sent Events) for the csv file validation and upload. Refer the api specs for more information.

You have a simple api with GET, POST, PUT, PATCH and DELETE operations with the cookie based authentication. There is also a csv file upload that uses the server sent events so you can listen to any incoming events on frontend. The file upload also just process the file and send the response and also uses server sent events.

## Api Specification

|DOCS                           |REDOCS                           |
|-------------------------------|---------------------------------|
|https://reelfake.cloud/api/docs|https://reelfake.cloud/api/redocs|

## How to access the apis?

The apis are accessible through https://reelfake.cloud/api. Not all the rouets are accessible. To know which routes are accessible, please follow the api specifications.

If you want to complete api access, you will either need to run it locally or need to bring your own cloud. Please follow the instructions below to get the api running.

## Running on localhost

### Start the container for database

<pre><code>docker run -d --name container_name_of_choice -p 5432:5432 -v volume_name_of_choice:/var/lib/postgresql/data \
-e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=password_of_choice pratapreddy15/reelfake-postgres</code></pre>

#### Verify the database is up

<code>docker logs -f container_name_from_above</code>

### Start the container for the api

For this step, you will need to generate the jwt secret (refer [Generating JWT Secret](#generating-jwt-secret))

<pre><code>docker run -d --name container_name_of_choice -p port_of_choice:8080 -e DB_HOST=172.17.0.2 \
-e DB_PORT=5432 -e DB_NAME=reelfake_db -e DB_USER=postgres -e DB_PASSWORD=password_from_above \
-e JWT_SECRET={{Generated JWT Secret}} pratapreddy15/reelfake-backend</code></pre>

#### Monitor the api logs (if REELFAKE_USERS_DB_NAME is enabled then you can see the db transaction related logs)

<pre><code>docker logs -f container_name_from_above</code></pre>

## Running on cloud

**Note:** I have used the api and database on Amazon Lightsail but you can deploy to any remote machine and use the IP Address (or dns if they provide).

The below instructions are for deploying to Amazon Lightsail that I use (make sure to check the price).

### Instance for database

1. Create an instance
   - Platform: Linux/Unix
   - Blueprint: Operating System (OS) only
   - Operating System: Amazon Linux 2023
   - Instance Plan: Dual-stack
   - Instance name: Any name of your choice
2. It is recommended to use SSH key for logging into the instance. To create the key, foolow [Set up SSH key for Lightsail](https://docs.aws.amazon.com/lightsail/latest/userguide/lightsail-how-to-set-up-ssh.html).
3. Once created, go to Networking tab
4. Make sure below rules are added (or add if missing)
   - SSH on port 22
   - HTTP on port 80
5. SSH into the in instance
6. Run the below docker command (you can change POSTGRES_USER and POSTGRES_PASSWORD of your choice)
   <pre><code>docker run -d --name container_name_of_choice -p 5432:5432 -v volume_name_of_choice:/var/lib/postgresql/data \
   -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=db_user_password_prod pratapreddy15/reelfake-postgres</code></pre>
7. If persisting data is not required, you can remove the volume mount
   <pre><code>docker run -d --name container_name_of_choice -p 5432:5432 \
   -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=db_user_password_prod pratapreddy15/reelfake-postgres</code></pre>

### Instance for api

1. The steps from 1 to 5 are same as database instance.
2. Generate the jwt secret (refer [Generating JWT Secret](#generating-jwt-secret))
3. Run the below docker command (you need to change DB_USER and DB_PASSWORD depending on what you entered when running database in above step)
   <pre><code>docker run -d --name container_name_of_choice -e DB_HOST={{IP Address}} \
   -e DB_PORT=5432 -e DB_NAME=reelfake_db -e DB_USER=postgres -e DB_PASSWORD=db_user_password_prod \
   -e JWT_SECRET={{Generated JWT Secret}} pratapreddy15/reelfake-backend</code></pre>

**Note:**

1. The docker command for deploying to Lightsail is same as running it locally. You will just need to change the DB_HOST for the api which must point to the database instance.
2. AWS keeps improving so the steps above might or might not change in future. Follow [Create a Lightsail Instance](https://docs.aws.amazon.com/lightsail/latest/userguide/how-to-create-amazon-lightsail-instance-virtual-private-server-vps.html) for guidance.

## Using the api

### Base url

The base url is https://reelfake.cloud/api if you are planning to use the one deployed to my instance. Otherwise depending on where you host the api the base url could differ. If you are running locally the bsae url will http://localhost:{{port}}/api or http://127.0.0.1:{{port}}/api. The port defaults to 8000 if you do not specify anything in the environment variable. If you are running on ec2, lightsail or any other cloud then the hostname will be the ip address depending on how you have configured the http traffic.

### Protected and Unprotected Routes

Some routes requires authentication through login and some routes can be accessed without login. To check which routes are protected or unprotected, please follow the [api specification](#api-specs).

### Using customer / staff / store manager for login

To login as customer, staff or any store manager you can fetch the data and decide which one to use. This does not require login.

|Resource     |Url Path                       |
|-------------|-------------------------------|
|Customer     |/api/customers/summary         |
|Staff        |/api/staff/summary             |
|Store Manager|/api/staff/managers/summary    |

To know the response returned by the summary api, please follow the [api specs](#api-specs).

Below are the sample request for setting the password.

*Customer*

```curl
curl --location --request PUT 'https://reelfake.cloud/api/customers/{id}/forgot_password' \
--header 'Content-Type: application/json' \
--data-raw '{
    "newPassword": "test@123",
    "confirmedNewPassword": "test@123"
}'
```

*Staff / Store Manager*

```curl
curl --location --request PUT 'https://reelfake.cloud/api/staff/{id}/forgot_password' \
--header 'Content-Type: application/json' \
--data-raw '{
    "newPassword": "test@123",
    "confirmedNewPassword": "test@123"
}'
```

## Examples

Get the list of customers, staff or store managers to choose from

|Resource     |Url Path                       |
|-------------|-------------------------------|
|Customer     |/api/customers/summary         |
|Staff        |/api/staff/summary             |
|Store Manager|/api/staff/managers/summary    |

### Forgot Password

```javascript showLineNumbers
const email = 'test@example.com';
const newPassword = 'test@123';
const confirmedNewPassword = 'test@123';

// For staff / store manager url will be https://reelfake.cloud/api/staff/1/forgot_password

const response = await fetch('https://reelfake.cloud/api/customers/1/forgot_password', {
   method: 'POST',
   headers: {
     'Content-Type': 'application/json',
     Accept: 'application/json',
   },
   body: JSON.stringify({
     email,
     newPassword,
     confirmedNewPassword,
   })
);

const jsonData = await response.json();

if (response.status !== 200) {
   throw new Error(jsonData.message);
}

```

### Login

```javascript showLineNumbers
const email = 'test@example.com';
const password = 'test@123';

const response = await fetch('https://reelfake.cloud/api/auth/login', {
   method: 'POST',
   headers: {
     'Content-Type': 'application/json',
     Accept: 'application/json',
   },
   body: JSON.stringify({
     email,
     password
   }),
   credentials: 'include',
);

const jsonData = await response.json();

if (response.status !== 200) {
   throw new Error(jsonData.message);
}
```

### Add Movie

```javascript
const sampleMovie = {
 tmdbId: 1242898,
 imdbId: 'tt31227572',
 title: 'Predator: Badlands',
 originalTitle: 'Predator: Badlands',
 overview: 'A young Predator outcast from his clan finds an unlikely ally on his journey in search of the ultimate adversary.',
 runtime: 107,
 releaseDate: '2025-11-07',
 genres: ['Action', 'Adventure', 'Science Fiction', 'Thriller'],
 countriesOfOrigin: ['US'],
 language: 'en',
 movieStatus: 'Released',
 popularity: 0.04,
 budget: 105000000,
 revenue: 200000000,
 ratingAverage: 7.6,
 ratingCount: 34000,
 posterUrl: 'https://image.tmdb.org/t/p/w500/ebyxeBh56QNXxSJgTnmz7fXAlwk.jpg',
};

// First, reset password if you haven't
// Second, login
// Finally, add a movie
const response = await fetch(`${baseUrl}/movies`, {
 method: 'POST',
 headers: requestHeaders,
 body: JSON.stringify(payload),
 credentials: 'include',
});

const json = await response.json();

if (response.status !== 201) {
 throw new Error(json.message);
}

console.log(json); // Console logging movie data
```

### Add Movie with Actors

```javascript
// Adding a movie with actors payload is same as adding a movie but differs only in payload

const sampleMovie = {
 tmdbId: 1242898,
 imdbId: 'tt31227572',
 title: 'Predator: Badlands',
 originalTitle: 'Predator: Badlands',
 overview: 'A young Predator outcast from his clan finds an unlikely ally on his journey in search of the ultimate adversary.',
 runtime: 107,
 releaseDate: '2025-11-07',
 genres: ['Action', 'Adventure', 'Science Fiction', 'Thriller'],
 countriesOfOrigin: ['US'],
 language: 'en',
 movieStatus: 'Released',
 popularity: 0.04,
 budget: 105000000,
 revenue: 200000000,
 ratingAverage: 7.6,
 ratingCount: 34000,
 posterUrl: 'https://image.tmdb.org/t/p/w500/ebyxeBh56QNXxSJgTnmz7fXAlwk.jpg',
 actors: [
   {
     tmdbId: 18050,
     imdbId: 'nm1102577',
     characterName: 'Thia / Tessa',
     castOrder: 0,
     actorName: 'Elle Fanning',
     biography:
       "Mary Elle Fanning (born April 9, 1998) is an American actress. As a child, she made her film debut as the younger version of her sister Dakota Fanning's character in the drama film I Am Sam (2001). She appeared in several other films as a child actress, including Daddy Day Care (2003), Babel (2006), The Curious Case of Benjamin Button and Phoebe in Wonderland (both 2008), and the miniseries The Lost Room (2006). She then had leading roles in Sofia Coppola's drama Somewhere (2010) and J. J. Abrams' science fiction film Super 8 (2011).\n\nFanning played Princess Aurora in the fantasy films Maleficent (2014) and Maleficent: Mistress of Evil (2019) while working in independent films such as Sally Potter's Ginger & Rosa (2012), Nicolas Winding Refn's The Neon Demon (2016), Mike Mills' 20th Century Women (2016), and Coppola's The Beguiled (2017). From 2020 to 2023, she starred as Catherine the Great in the Hulu period satire series The Great, for which she received nominations for a Primetime Emmy Award and two Golden Globe Awards. She has since portrayed Michelle Carter in the Hulu limited series The Girl from Plainville (2022), made her Broadway debut in the play Appropriate (2023), and played a character based on Suze Rotolo in the biographical drama A Complete Unknown (2024).\n\nDescription above from the Wikipedia article Elle Fanning, licensed under CC-BY-SA, full list of contributors on Wikipedia.",
     birthday: '1998-04-09',
     deathday: null,
     placeOfBirth: 'Conyers, Georgia, USA',
     popularity: 27.431,
     profilePictureUrl: 'https://image.tmdb.org/t/p/w500/e8CUyxQSE99y5IOfzSLtHC0B0Ch.jpg',
   },
   {
     tmdbId: 3223391,
     imdbId: 'nm10921048',
     characterName: 'Dek / Father',
     castOrder: 1,
     actorName: 'Dimitrius Schuster-Koloamatangi',
     biography: '',
     birthday: '2001-02-06',
     deathday: null,
     placeOfBirth: null,
     popularity: 2.0463,
     profilePictureUrl: 'https://image.tmdb.org/t/p/w500/rmIZTT1AZK3C9fYhEOtGKtSrF8E.jpg',
   },
   {
     tmdbId: 5780413,
     imdbId: 'nm17849525',
     characterName: 'Bud',
     castOrder: 2,
     actorName: 'Rohinal Nayaran',
     biography: '',
     birthday: null,
     deathday: null,
     placeOfBirth: null,
     popularity: 0.4074,
     profilePictureUrl: null,
   },
   {
     tmdbId: 2253146,
     imdbId: 'nm4663694',
     characterName: 'Kwei (Suit)',
     castOrder: 3,
     actorName: 'Michael Homick',
     biography:
       'Michael Homick is a stuntman.\n\nIn Game of Thrones, he was a stunt double for Hafþór Júlíus Björnsson in upcoming episodes of the eighth season.',
     birthday: null,
     deathday: null,
     placeOfBirth: null,
     popularity: 0.5039,
     profilePictureUrl: 'https://image.tmdb.org/t/p/w500/a7IFYVtmNvBMJ7c20BVMc0LX6PT.jpg',
   },
   {
     tmdbId: 1636658,
     imdbId: 'nm3712374',
     characterName: 'Kwei (voice)',
     castOrder: 4,
     actorName: 'Stefan Grube',
     biography: '',
     birthday: null,
     deathday: null,
     placeOfBirth: null,
     popularity: 0.3338,
     profilePictureUrl: null,
   },
   {
     tmdbId: 1440649,
     imdbId: 'nm2174554',
     characterName: 'Father (Suit)',
     castOrder: 5,
     actorName: 'Reuben De Jong',
     biography:
       "From Wikipedia, the free encyclopedia\n\nReuben de Jong is a New Zealand heavyweight kickboxer, mixed martial artist, strongman and professional wrestler of Dutch descent. He is a two-time professional strongman champion of New Zealand and competed in the K-1 Kings of Oceania in 2006 and 2007. De Jong is the holder of two national records in the farmer's walk and stone lifting, and the Guinness World Record for running through the most panes of glass in under one minute. He was signed with WWE under the name of Russell Walker in 2011, but was released the same year.\n\nA television actor and stuntman, De Jong has had small roles in Maddigan's Quest, Legend of the Seeker, and as Theokoles in Spartacus: Blood and Sand. In 2010, he entered professional wrestling and became one of the stars of Impact Pro Wrestling, capturing the IPW New Zealand Heavyweight Championship within two months of his debut. On December 7, 2019 he won the Hughes Academy Championship, pinning Spencer Kyle.",
     birthday: null,
     deathday: null,
     placeOfBirth: 'Waitakere, West Auckland, New Zealand',
     popularity: 0.6187,
     profilePictureUrl: 'https://image.tmdb.org/t/p/w500/opjLobu1AKKspKfYzY6AXrjUglt.jpg',
   },
   {
     tmdbId: 1856011,
     imdbId: 'nm7211245',
     characterName: 'Drone Synth',
     castOrder: 6,
     actorName: 'Cameron Brown',
     biography: '',
     birthday: null,
     deathday: null,
     placeOfBirth: ' New Zealand',
     popularity: 0.2962,
     profilePictureUrl: 'https://image.tmdb.org/t/p/w500/jLEKQbppMDHeiFX23bxrcmT5dmh.jpg',
   },
   {
     tmdbId: 1257565,
     imdbId: 'nm2226071',
     characterName: 'MU/TH/UR (voice)',
     castOrder: 7,
     actorName: 'Alison Wright',
     biography: 'Alison Wright was born on July 12, 1976 in England. She is an actress.',
     birthday: '1976-07-12',
     deathday: null,
     placeOfBirth: 'Sunderland, England, UK',
     popularity: 1.2853,
     profilePictureUrl: 'https://image.tmdb.org/t/p/w500/yVdCk5eWk5syRrBdxjrnJ1O2Rpg.jpg',
   },
   {
     tmdbId: 1179419,
     imdbId: 'nm1819972',
     characterName: "Kwei's Ship Computer (voice)",
     castOrder: 8,
     actorName: 'Matt Duffer',
     biography:
       'Matt Duffer and his twin brother Ross Duffer (born 1984), known professionally as the Duffer Brothers,  are American twin brothers who write and direct science fiction and  horror shows for film and television. They are best known for the 2015  horror Hidden and the 2016 Netflix science fiction horror series Stranger Things. They have also written episodes for Wayward Pines.',
     birthday: '1984-02-15',
     deathday: null,
     placeOfBirth: 'Durham, North Carolina, USA',
     popularity: 0.9209,
     profilePictureUrl: 'https://image.tmdb.org/t/p/w500/kXO5CnSxC0znMAICGxnPeuGP73U.jpg',
   },
   {
     tmdbId: 1179422,
     imdbId: 'nm1819973',
     characterName: "Kwei's Ship Computer (voice)",
     castOrder: 9,
     actorName: 'Ross Duffer',
     biography:
       'Ross Duffer and his twin brother Matt Duffer (born 1984), known professionally as the Duffer Brothers,  are American twin brothers who write and direct science fiction and  horror shows for film and television. They are best known for the 2015  horror Hidden and the 2016 Netflix science fiction horror series Stranger Things. They have also written episodes for Wayward Pines.',
     birthday: '1984-02-15',
     deathday: null,
     placeOfBirth: 'Durham, North Carolina, USA',
     popularity: 1.6196,
     profilePictureUrl: 'https://image.tmdb.org/t/p/w500/kN1HdFViQkcJOQlNcvvFJIx9Uju.jpg',
   },
   {
     tmdbId: 1891826,
     imdbId: 'nm6842456',
     characterName: 'Bud',
     castOrder: 10,
     actorName: 'Ravi Narayan',
     biography: '',
     birthday: null,
     deathday: null,
     placeOfBirth: null,
     popularity: 0.0802,
     profilePictureUrl: 'https://image.tmdb.org/t/p/w500/iM9dr3AjXTt7IGpRzZlQVG7hINa.jpg',
   },
 ],
  };

// First, reset password if you haven't
// Second, login
// Finally, add a movie
const response = await fetch(`${baseUrl}/movies`, {
 method: 'POST',
 headers: requestHeaders,
 body: JSON.stringify(payload),
 credentials: 'include',
});

const json = await response.json();

if (response.status !== 201) {
 throw new Error(json.message);
}

console.log(json); // Console logging movie data
```

### Generating JWT Secret

In the terminal, run below command

<pre><code>node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"</code></pre>

if you do not have node installed, you can use openssl tool

<pre><code>openssl rand -hex 32`</code></pre>

## License

MIT
