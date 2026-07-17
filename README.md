# Reelfake REST API

## DISCLAIMER

1. The movies, actors, genres and movie languages are taken from the [The Movie Database (TMDB) API](https://developer.themoviedb.org/docs/getting-started). You must adhere to the [terms and agreements](https://www.themoviedb.org/api-terms-of-use?language=en-US) of their api which is modified and added new tables to better suit my needs.
2. The sample payload used as an example for adding a movie are taken directly from [The Movie DB](https://www.themoviedb.org).
3. The db schema is inspired from the [PostgreSQL Sample Database by NEON](https://neon.com/postgresql/postgresql-getting-started/postgresql-sample-database).
4. Please make sure to adhere to the licensing terms of TMDB API and do not use the reelfake api for commercial purpose. This api is only for knowledge, practice and educational purposes.

# Table of Contents

1. [Introduction](#introduction)
2. [API Specs](#api-specification)
3. [Running locally](#running-on-localhost)<br>
   a. [Start database](#start-the-container-for-database)<br>
   b. [Start api](#start-the-container-for-the-api)<br>
4. [Running on Cloud](#running-on-cloud)<br>
   a. [Start database instance](#instance-for-database)<br>
   b. [Start api instance](#instance-for-api)<br>
5. [Postman Collection](#postman-collection)<br>
6. [Examples](#examples)<br>
   a. [Forgot Password](#forgot-password)<br>
   b. [Login](#login)<br>
   c. [Add Movie](#add-movie)<br>
   d. [Add Movie with Actors](#add-movie-with-actors)<br>
   e. [Track File Validation for Upload](#track-file-validation-for-upload)<br>
7. [Generating JWT Secret](#generating-jwt-secret)

## Introduction

A rest api that provides data for practicing, prototyping or anything to play with for the frontend development. This api is build with the real sql database so when you update the data is really updated and when you create the data is really created.

#### Reelfake api provides a set of features such as
* Real time CRUD operations. Create, update and delete mutate the data in the database and when you fetch data you get the updated one.
* Pagination. The GET methods for some resources like movie, actor and customer implements a pagination feature. Refer the api specs for more information.
* Cookie based authentication. There are some operations which requires you to login.
* Role based authorization. Some resources has a role-based access. For instance, only store manager can add a movie, delete a customer or bulk upload movies.
* File upload. The movie api provides a capability to let you send a csv file with the movie records for bulk create.
* Server sent events. The movie api implements the SSE (Server-Sent Events) for the csv file validation and upload. Refer the api specs for more information.

You have a simple api with GET, POST, PUT, PATCH and DELETE operations with the cookie based authentication. There is also a csv file upload that uses the server sent events so you can listen to any incoming events on frontend. The file upload also just process the file and send the response and also uses server sent events.

## Api Specification

|DOCS                            |REDOCS                            |
|--------------------------------|----------------------------------|
|http://localhost:{PORT}/api/docs|http://localhost:{PORT}/api/redocs|

## Running on localhost

We will use below names for the docker resources
|             |Container        |
|-------------|-----------------|
|Database     |reelfake-db      |
|API          |reelfake-api     |

|Volume       |Network          |
|-------------|-----------------|
|reelfake-vol |reelfake-net     |

### Start the container for database

<pre><code>docker run -d --name reelfake-db -p 5432:5432 -v reelfake-vol:/var/lib/postgresql/data \
-e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=password_of_choice pratapreddy15/reelfake-postgres</code></pre>

#### Verify the database is up

<code>docker logs -f reelfake-db</code>

#### Create a network to connect the database and api
<code>docker network create reelfake-net</code>

#### Connect the database container to the network
<code>docker network connect reelfake-net</code>

### Start the container for the api

For this step, you will need to generate the jwt secret (refer [Generating JWT Secret](#generating-jwt-secret))

<pre><code>docker run -d --name reelfake-api -p port_of_choice:8080 -e DB_HOST=reelfake-db \
-e DB_PORT=5432 -e DB_NAME=reelfake_db -e DB_USER=postgres -e DB_PASSWORD=password_from_above \
-e JWT_SECRET={{Generated JWT Secret}} --network reelfake-net pratapreddy15/reelfake-backend</code></pre>

### Start the container for the api (with sql related logs)

<pre><code>docker run -d --name reelfake-api -p port_of_choice:8080 -e ENABLE_SEQUELIZE_LOGS=true -e DB_HOST=reelfake-db \
-e DB_PORT=5432 -e DB_NAME=reelfake_db -e DB_USER=postgres -e DB_PASSWORD=password_from_above \
-e JWT_SECRET={{Generated JWT Secret}} --network reelfake-net pratapreddy15/reelfake-backend</code></pre>

#### Monitor the api logs (if ENABLE_SEQUELIZE_LOGS is enabled then you can see the db transaction related logs)

<pre><code>docker logs -f reelfake-api</code></pre>

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

## Postman Collection

You can use the [postman collection](https://raw.githubusercontent.com/reelfake/reelfake-node/refs/heads/main/postman/reelfake_api_postman.json). This postman collection assumes you are running the api on localhost on port 8000. But you can change the host to where ever you are hosting.
Note that this postman collection does not have all the requests mostly POST, PUT and DELETE that mutates the data.

## Examples

**Note:**
All the examples are targetting localhost:8000 which you can change to where ever you have hosted the api (which could be localhost also).

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

// For staff / store manager url will be http://localhost:8000/api/staff/1/forgot_password

const response = await fetch('http://localhost:8000/api/customers/1/forgot_password', {
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

const response = await fetch('http://localhost:8000/api/auth/login', {
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
const response = await fetch('http://localhost:8000/api/movies', {
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

Adding a movie with actors is same as adding a movie above but only differs in the payload

```javascript
{
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
 ],
}
```

### Track File Validation for Upload

The route /movies/upload/validate provides a query option enable_tracking that sends the tracking url that implements the server sent events.

You can download the [sample csv](https://drive.google.com/file/d/1vsubzQ-HyZX6OZtK5Tb0vWiUBU0CgiCF/view?usp=sharing) file to try the file validation api.

```javascript
// The csv file upload feature is accessible only to store manager role

// Login as store manager (using the forgot password route to reset password for any store manager)

const baseUrl = 'http://localhost:8000/api';

async function uploadFile(formData) {
  try {
    // delay_event_ms query parameter is used to pause between events send back from the server. Maximum allowed delay is 1 second
    const response = await fetch(`${baseUrl}/movies/upload/validate?enable_tracking&delay_event_ms=500`, {
      method: 'POST',
      body: formData,
      header: requestHeaders,
      credentials: 'include',
    });
    const json = await response.json();
    if (response.status !== 202) {
      return json.message;
    }

    const { trackingUrl } = json;

    return trackingUrl;
  } catch (err) {
    return err.message;
  }
}

let eventSource;

const form = document.getElementById('form');
form.addEventListener('submit', e => {
   e.preventDefault();

   const formData = new FormData(e.target);
   const trackingUrl = await uploadFile(formData);

   eventSource = new EventSource(trackingUrl, { withCredentials: true });
   eventSource.onopen = () => {
      // Update UI if needed
   };
   
   eventSource.onerror = e => {
      eventSource.close();
      // Update UI to show error
   };

   eventSource.onmessage = e => {
      const data = JSON.parse(e.data);

      // data will be

      // If processing
      // status - Processing means the csv file is being processed
      // rowNumber - The row number for the row from the csv file (the first row number is 1, seecond one is 2 and so on)
      // isValid - Whether the row passed validation or not
      // reasons - Reasons for why the row is marked as invalid
      /*
         {
            status: 'processing',
            rowNumber: <<number>>,
            isValid: <<boolean>>,
            reasons: <<string[]>>
         }
      */

      // If error
      // The below payload is for any error encountered when processing the csv file
      // Note: This error is not the valiation outcome
      /*
         {
            status: 'error',
            message: <<string>>
         }
      */

      // If done
      // status - The status 'done' means the processing is finished and the below data is the summary result
      // totalRows - The total number of rows from the csv file
      // processedRowsCount - The number of rows processed by the server
      // validRowsCount - The number of valid rows in the csv file that can be used to create the movies
      // invalidRowsCount - The number of invalid rows in the csv file that canno tbe used for creating the movie
      /*
         {
            status: 'done',
            totalRows: <<number>>,
            processedRowsCount: <<number>>,
            validRowsCount: <<number>>,
            invalidRowsCount: <<number>>
         }
      */
   };

   // If the UI has a button to cancel the event streaming then below snippet is to cancel it
   const cancelButton = document.getElementById('cancel-button');
   cancelButton.addEventListener('click', () => {
      if (eventSource) {
         eventSource.close();
      }
   });
});
```

### Generating JWT Secret

In the terminal, run below command

<pre><code>node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"</code></pre>

if you do not have node installed, you can use openssl tool

<pre><code>openssl rand -hex 32`</code></pre>

## License

MIT
