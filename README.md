# Reelfake REST API

## DISCLAIMER

1. The movies, actors, genres and movie languages are taken from the [The Movie Database (TMDB) API](https://developer.themoviedb.org/docs/getting-started). You must adhere to the [terms and agreements](https://www.themoviedb.org/api-terms-of-use?language=en-US) of their api which is modified and added new tables to better suit my needs.
2. The db schema is inspired from the [PostgreSQL Sample Database by NEON](https://neon.com/postgresql/postgresql-getting-started/postgresql-sample-database).
3. Please make sure to adhere to the licensing terms of TMDB API and do not use the reelfake api for commercial purpose. This api is only for knowledge, practice and educational purposes.

# Table of Contents

1. [Introduction](#introduction)
2. [API for Public Use](#api-for-public-use)
3. [Running locally](#running-on-localhost)<br>
   a. [Start database](#start-the-container-for-database)<br>
   b. [Start api](#start-the-container-for-the-api)<br>
4. [Running on Cloud](#running-on-cloud)<br>
   a. [Start database instance](#instance-for-database)<br>
   b. [Start api instance](#instance-for-api)<br>
5. [Using the api](#using-the-api)<br>
   a. [Base url](#base-url)<br>
   b. [Auth-less endpoints](#auth-less-endpoints)<br>
   c. [Protected endpoints](#protected-endpoints)<br>
   d. [Using customer for login](#using-customer-for-login)<br>
   e. [Using staff for login](#using-staff-for-login)<br>
   f. [Using store manager for login](#using-store-manager-for-login)<br>
6. [Using reelfake.cloud](#using-my-cloud-instance)
7. [Examples](#examples)<br>
   a. [Login](#login)<br>
   b. [Add a movie](#add-a-movie)<br>
   c. [Logout](#logout)<br>
   d. [Expired Token](#expired-token)<br>
8. [Api Specs](#api-specification)
9. [Generating JWT Secret](#generating-jwt-secret)

## Introduction

A rest api that provides data for practicing, prototyping or anything to play with for the frontend development. This api is build with the real sql database so when you update the data is really updated and when you create the data is really created.

You have a simple api with GET, POST, PUT, PATCH and DELETE operations with the cookie based authentication. There is also a csv file upload that uses the server sent events so you can listen to any incoming events on frontend. The file upload also just process the file and send the response and also uses server sent events.

**APIs**

- Authentication (login and logout)
- City
- Country
- Address
- Genre
- Movie language
- Actor
- Movie
- Staff
- Store
- Customer
- Rental

## API for Public Use

I have the api deployed for my personal use which is available for public.
This publicly available api does not have the routes that mutate the data.
You can access this using the [Reelfake api](https://reelfake.cloud) which is for my personal use.
You can go through the [api specs](https://reelfake.cloud/api/docs) or the [redocs](https://reelfake.cloud/api/redocs) for more information.
So, what this api provide?

1. All GET methods (like `/api/movies`, `/api/actors`, `/api/customers`, `/api/movies/:id` and so on).
2. The login (`/api/auth/login`) and logout (`/api/auth/logout`).
3. The new user registration endpoints (i.e. `/api/customers/register` and `/api/staff/register`).
4. Endpoints for forgotten password (i.e. `/api/customers/:id/forgot_password` and `/api/staff/:id/forgot_password`).
5. Endpoints for changing password (i.e. `/api/customers/:id/change_password` and `/api/staff/:id/change_password`).

**Notes:**

1. Although the api is for public, I purge the database weekly to keep my Lightsail instances clean and lightweight.
2. When I purge the database, I re-seed the database which are part of the docker image. So, whatever you created the users or any data will be removed.
3. Though I have provided limited access to my deployed api, you can hit it as per the api documentation but you will `403 Forbidden` if you do so.

## Running on localhost

### Start the container for database

<pre><code>docker run -d --name container_name_of_choice -p 5432:5432 -v volume_name_of_choice:/var/lib/postgresql/data \
-e POSTGRES_USER=username_of_choice -e POSTGRES_PASSWORD=password_of_choice pratapreddy15/reelfake-postgres</code></pre>

#### Verify the database is up

<code>docker logs -f container_name_from_above</code>

### Start the container for the api

For this step, you will need to generate the jwt secret (refer [Generating JWT Secret](#generating-jwt-secret))

<pre><code>docker run -d --name container_name_of_choice -p port_of_choice:8080 -e DB_HOST=172.17.0.2 \
-e DB_PORT=5432 -e DB_NAME=reelfake_db -e DB_USER=username_from_above -e DB_PASSWORD=password_from_above \
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
   -e POSTGRES_USER=db_username_prod -e POSTGRES_PASSWORD=db_user_password_prod pratapreddy15/reelfake-postgres</code></pre>
7. If persisting data is not required, you can remove the volume mount
   <pre><code>docker run -d --name container_name_of_choice -p 5432:5432 \
   -e POSTGRES_USER=db_username_prod -e POSTGRES_PASSWORD=db_user_password_prod pratapreddy15/reelfake-postgres</code></pre>

### Instance for api

1. The steps from 1 to 5 are same as database instance.
2. Generate the jwt secret (refer [Generating JWT Secret](#generating-jwt-secret))
3. Run the below docker command (you need to change DB_USER and DB_PASSWORD depending on what you entered when running database in above step)
   <pre><code>docker run -d --name container_name_of_choice -e DB_HOST={{IP Address}} \
   -e DB_PORT=5432 -e DB_NAME=reelfake_db -e DB_USER=db_username_prod -e DB_PASSWORD=db_user_password_prod \
   -e JWT_SECRET={{Generated JWT Secret}} pratapreddy15/reelfake-backend</code></pre>

**Note:**

1. The docker command as for deploying to Lightsail is same as running it locally. You will just need to change the DB_HOST for the api which must point to the database instance.
2. AWS keeps improving so the steps above might or might not change in future. Follow [Create a Lightsail Instance](https://docs.aws.amazon.com/lightsail/latest/userguide/how-to-create-amazon-lightsail-instance-virtual-private-server-vps.html) for guidance.

## Using the api

### Base url

Depending on where you host the api the base url could differ. If you are running locally the bsae url will http://localhost:{{port}}/api or http://127.0.0.1:{{port}}/api. The port defaults to 8000 if you did not specify anything in the environment variable. If you are running on ec2, lightsail or any other cloud then the hostname will be the ip address depending on how you have configured the http traffic.

### Auth-less endpoints

There are api routes that does not need user login. These are listed below. You can get more information on how to use apis using the api docs at {{BASE_URL}}/docs or {{BASE_URL}}/redocs.

- address
  1. GET /addresses
  2. GET /address/city/{{city_name}}
  3. GET /addresses/state/{{state_name}}
- city
  1. GET /cities
- country
  1. GET /countries
- actor
  1. GET /actors
  2. GET /actors/{{id}}
- customer
  1. GET /customers
  2. GET /customers/{{id}}
  3. GET /customers/summary
  4. POST /customers
  5. PUT /customers/{{id}}/forgot_customer
- movie
  1. GET /movies
  2. GET /movies/{{id}}
  3. GET /movies/{{id}}/stores
- genre
  1. GET /genres
- movie language
  1. GET /movie_languages
- staff
  1. GET /staff/summary
  2. GET /staff/managers/summary
- store
  1. GET /stores
  2. GET /stores/{{id}}
  3. GET /stores/{{id}}/stock
  4. GET /stores/{{id}}/movies

### Protected endpoints

There are api routes which needs authentication through user login. These are listed below. You can get more information on how to use apis using the api docs at {{BASE_URL}}/docs or {{BASE_URL}}/redocs.

- actor
  1. POST /actors
  2. POST /actors/{{id}}
  3. PUT /actors/{{id}}
  4. DELETE /actors/{{id}
- customer
  1. PUT /customers/{{id}}/change_password
  2. PUT /customers/{{id}}
  3. DELETE /customers/{{id}}
  4. PATCH /customers/{{id}}/activate
  5. PATCH /customers/{{id}/deactivate
  6. PATCH /customers/{{id}/preferred_store/{{store_id}}
- movie
  1. POST /movies
  2. PUT /movies/{{id}}
  3. DELETE /movies/{{id}}
  4. POST /movies/{{id}}/add_actors
  5. POST /movies/upload/validate
  6. GET /movies/upload/track_validation
  7. POST /movies/upload
  8. GET /movies/upload/track
- movie language

- staff
  1. PUT /staff/{{id}}/change_password
  2. POST /staff
  3. PUT /staff/{{ud}}
  4. DELETE /staff/{{id}}
- store
  1. POST /stores
  2. PUT /stores/{{id}}
  3. DELETE /stores/{{id}}
  4. GET /stores/{{id}}/staff
- rental
  1. GET /rentals
  2. GET /rentals/my_store
  3. GET /rentals/{{id}}

### Using customer for login

To login as customer, you will need to choose the customer using the endpoint `/customers/summary`.<br>
Once you decide which customer to use, call the endpoint `/customers/{{id}}/forgot_password` with the below json request body.<br>

<pre><code>
{
   "newPassword": "password_of_your_choice,
   "confirmedNewPassword": "password_of_your_choice"
}
</code></pre>

You will get the response containing the email of the customer.<br>
Using the email and the password you have just changed login using the endpoint `/auth/login` with the below json request body.<br>

<pre><code>
{
   "email": "email_address_of_customer",
   "password": "password_you_had_chosen"
}
</code></pre>

### Using staff for login

To login as staff, you will need to choose the staff using the endpoint `/staff/summary`.<br>
Once you decide which staff to use, call the endpoint `/staff/{{id}}/forgot_password` with the below json request body.<br>

<pre><code>
{
   "newPassword": "password_of_your_choice,
   "confirmedNewPassword": "password_of_your_choice"
}
</code></pre>

You will get the response containing the email of the staff.<br>
Using the email and the password you have just changed login using the endpoint `/auth/login` with the below json request body.<br>

<pre><code>
{
   "email": "email_address_of_staff",
   "password": "password_you_had_chosen"
}
</code></pre>

### Using store manager for login

To login as store manager, you will need to choose the store manager using the endpoint `/staff/managers/summary`.<br>
Once you decide which store manager to use, call the endpoint `/staff/{{id}}/forgot_password` with the below json request body.<br>

<pre><code>
{
   "newPassword": "password_of_your_choice,
   "confirmedNewPassword": "password_of_your_choice"
}
</code></pre>

You will get the response containing the email of the store manager.<br>
Using the email and the password you have just changed login using the endpoint `/auth/login` with the below json request body.<br>

<pre><code>
{
   "email": "email_address_of_store_,manager",
   "password": "password_you_had_chosen"
}
</code></pre>

## Using my cloud instance

I have developed this api for my personal use to practice or try new features in the web development space. For this, I have deployed this to [reelfake.cloud](https://reelfake.cloud/api).<br>
But I have made some of the apis to public use for you all to try. All the endpoints except the ones with methods POST, PUT, PATCH and DELETE are disallowed.<br>
The login, register user, change and forgot password routes are also available for you to use.<br>
Apart from these, the `GET /api/movies/upload/track` is not allowed and `POST /api/movies/upload/validate` is allowed.<br>
So, basically anything related to mutating or creating new records (like movies, actors, stores, etc) are prohibited.

## Examples

### Login

Let's try login as store manager. We will reelfake.cloud for this purpose.

Get the id of the store manager to use.

`GET https://reelfake.cloud/api/staff/managers/summary`

_*Sample Response*:_

<pre><code>
{
   "items": [
      {
         "id": 18,
         "firstName": "Robert",
         "lastName": "Hale",
         "email": "roberthale11@example.com",
         "active": true
      },
      {
         "id": 43,
         "firstName": "Jeffrey",
         "lastName": "Franklin",
         "email": "jeffreyfranklin09@example.com",
         "active": true
      },
      {
         "id": 47,
         "firstName": "Kevin",
         "lastName": "Morrison",
         "email": "kevinmorrison20@example.com",
         "active": true
      }
   ],
   "length": 3
}
</code></pre>

Let's use id 18 that belongs to Robert Hale.

Change the password for Robert.

`PUT https://reelfake.cloud/api/staff/18/forgot_password`

_*Request body*:_

<pre><code>
{
   "newPassword": "test@123",
   "confirmedNewPassword": "test@123"
}
</code></pre>

_*Response body*:_

<pre><code>
{
   "id": 18,
   "email": "roberthale11@example.com"
}
</code></pre>

Login as Robert Hale.

`POST https://reelfake.cloud/api/auth/login`

_*Request body*:_

<pre><code>
{
   "email": "roberthale11@example.com",
   "password": "test@123"
}
</code></pre>

_*Response body*:_

<pre><code>
{
   "message": "Login successful"
}
</code></pre>

The authentication token will be sent in the cookie. The token name is auth_token which will be valid for 1 hour.

Get the user profile of the logged in user

`GET https://reelfake.cloud/api/auth/me`

_*Response body*:_

<pre><code>
{
   "id": 18,
   "firstName": "Robert",
   "lastName": "Hale",
   "email": "roberthale11@example.com",
   "isStoreManager": true,
   "active": true,
   "phoneNumber": "+1-868-555-4346",
   "avatar": null,
   "address": {
      "id": 19,
      "addressLine": "04719 Carr Plain Apt. 754",
      "cityName": "Albury-Wodonga",
      "stateName": "New South Wales",
      "country": "Australia",
      "postalCode": "87384"
   },
   "store": {
      "id": 1,
      "phoneNumber": "8905108936",
      "address": {
            "id": 1,
            "addressLine": "1677 Jeanette Bridge",
            "cityName": "Albury-Wodonga",
            "stateName": "New South Wales",
            "country": "Australia",
            "postalCode": "46949"
      }
   }
}
</code></pre>

### Add a movie

`POST https://reelfake.cloud/api/movies`

_*Request body*:_

<pre><code>
{
   "tmdbId": 0484782,
   "imdbId": "tt31227572",
   "title": "Predator: Badlands",
   "originalTitle": "Predator: Badlands",
   "overview": "A young Predator outcast from his clan finds an unlikely ally on his journey in search of the ultimate adversary.",
   "runtime": 107,
   "releaseDate": "2025-11-07",
   "genres": [
      "Action",
      "Adventure",
      "Science Fiction",
      "Thriller"
   ],
   "countriesOfOrigin": [
      "US"
   ],
   "language": "en",
   "movieStatus": "Released",
   "popularity": 0.04,
   "budget": 105000000,
   "revenue": 200000000,
   "ratingAverage": 7.6,
   "ratingCount": 34000,
   "posterUrl": "https://image.tmdb.org/t/p/w500/ebyxeBh56QNXxSJgTnmz7fXAlwk.jpg"
}
</code></pre>

_*Response body*:_

<pre><code>
{
   "id": 123456,
   "title": "Predator: Badlands",
   "originalTitle": "Predator: Badlands",
   "overview": "A young Predator outcast from his clan finds an unlikely ally on his journey in search of the ultimate adversary.",
   "runtime": 107,
   "releaseDate": "2025-11-07",
   "genres": [
      "Action",
      "Adventure",
      "Science Fiction",
      "Thriller"
   ],
   "countriesOfOrigin": [
      "US"
   ],
   "movieStatus": "Released",
   "popularity": 0.04,
   "budget": "105000000",
   "revenue": "200000000",
   "ratingAverage": 7.6,
   "ratingCount": 34000,
   "posterUrl": "https://image.tmdb.org/t/p/w500/ebyxeBh56QNXxSJgTnmz7fXAlwk.jpg",
   "rentalRate": "20.00",
   "language": "en"
}
</code></pre>

To get the movie detail

`GET https://reelfake.cloud/api/movies/123456`

### Logout

Logging out will clear the token and will not allow any of the protected routes to go through.

`GET https://reelfake.cloud/api/auth/logout`

_*Response body*:_

<pre><code>
{
   "message": "Logged out successfully"
}
</code></pre>

### Expired Token

After successfull login, the token will remain valid for 1 hour. If the token is expired below response is returned.

<pre><code>
{
   "status": "error",
   "message": "Invalid or expired token"
}
</code></pre>

## Api Specification

_If running locally (the port is what you mentioned when running the container)_

<pre>
   Docs - http://localhost:{{port}}/api/docs
   Redocs - http://localhost:{{port}}/api/redocs
</pre>

_If running on cloud_

<pre>
   Docs - http://{{Ip Address or host DNS}}/api/docs
   Redocs - http://{{Ip Address or host DNS}}/api/redocs
</pre>

### Generating JWT Secret

In the terminal, run below command

<pre><code>node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"</code></pre>

if you do not have node installed, you can use openssl tool

<pre><code>openssl rand -hex 32`</code></pre>

## License

MIT
