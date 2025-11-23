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
   c. [Using customer for login](#using-customer-for-login)<br>
   d. [Using staff for login](#using-staff-for-login)<br>
   e. [Using store manager for login](#using-store-manager-for-login)<br>
7. [Using reelfake.cloud](#using-my-cloud-instance)
8. [Examples](#examples)<br>
   a. [Forgot Password](#forgot-password)<br>
   b. [Login](#login)<br>
9. [Generating JWT Secret](#generating-jwt-secret)

## Introduction

A rest api that provides data for practicing, prototyping or anything to play with for the frontend development. This api is build with the real sql database so when you update the data is really updated and when you create the data is really created.

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

1. The docker command for deploying to Lightsail is same as running it locally. You will just need to change the DB_HOST for the api which must point to the database instance.
2. AWS keeps improving so the steps above might or might not change in future. Follow [Create a Lightsail Instance](https://docs.aws.amazon.com/lightsail/latest/userguide/how-to-create-amazon-lightsail-instance-virtual-private-server-vps.html) for guidance.

## Using the api

### Base url

Depending on where you host the api the base url could differ. If you are running locally the bsae url will http://localhost:{{port}}/api or http://127.0.0.1:{{port}}/api. The port defaults to 8000 if you did not specify anything in the environment variable. If you are running on ec2, lightsail or any other cloud then the hostname will be the ip address depending on how you have configured the http traffic.

### Protected and Unprotected Routes

Some routes requires authentication through login and some routes can be accessed without login. To check which routes are protected or unprotected, please follow the [api specification](#api-specs).

### Using customer for login

To login as customer, you will need to choose the customer using the endpoint `/customers/summary`.<br>
Once you decide which customer to use, call the endpoint `/customers/{{id}}/forgot_password` with the below json request body.<br>

```json
{
   "newPassword": "password_of_your_choice,
   "confirmedNewPassword": "password_of_your_choice"
}
```

You will get the response containing the email of the customer.<br>
Using the email and the password you have just changed login using the endpoint `/auth/login` with the below json request body.<br>

```json
{
   "email": "email_address_of_customer",
   "password": "password_you_had_chosen"
}
```

### Using staff for login

To login as staff, you will need to choose the staff using the endpoint `/staff/summary`.<br>
Once you decide which staff to use, call the endpoint `/staff/{{id}}/forgot_password` with the below json request body.<br>

```json
{
   "newPassword": "password_of_your_choice,
   "confirmedNewPassword": "password_of_your_choice"
}
```

You will get the response containing the email of the staff.<br>
Using the email and the password you have just changed login using the endpoint `/auth/login` with the below json request body.<br>

```json
{
   "email": "email_address_of_staff",
   "password": "password_you_had_chosen"
}
```

### Using store manager for login

To login as store manager, you will need to choose the store manager using the endpoint `/staff/managers/summary`.<br>
Once you decide which store manager to use, call the endpoint `/staff/{{id}}/forgot_password` with the below json request body.<br>

```json
{
   "newPassword": "password_of_your_choice,
   "confirmedNewPassword": "password_of_your_choice"
}
```

You will get the response containing the email of the store manager.<br>
Using the email and the password you have just changed login using the endpoint `/auth/login` with the below json request body.<br>

```json
{
   "email": "email_address_of_store_,manager",
   "password": "password_you_had_chosen"
}
```

## Using my cloud instance

I have developed this api for my personal use to practice or try new features in the web development space. For this, I have deployed this to [reelfake.cloud](https://reelfake.cloud/api).<br>
But I have made some of the apis to public use for you all to try. All the endpoints except the ones with methods POST, PUT, PATCH and DELETE are disallowed.<br>
The login, register user, change and forgot password routes are also available for you to use.<br>
Apart from these, the `GET /api/movies/upload/track` is not allowed and `POST /api/movies/upload/validate` is allowed.<br>
So, basically anything related to mutating or creating new records (like movies, actors, stores, etc) are prohibited.

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
   })
);

const jsonData = await response.json();

if (response.status !== 200) {
   throw new Error(jsonData.message);
}
```

### Generating JWT Secret

In the terminal, run below command

<pre><code>node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"</code></pre>

if you do not have node installed, you can use openssl tool

<pre><code>openssl rand -hex 32`</code></pre>

## License

MIT
