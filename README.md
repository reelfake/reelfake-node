# Table of Contents

1. [Introduction](#reelfake-rest-api)
2. [API for Public Use](#api-for-public-use)
3. [Running locally](#running-on-localhost)
   1. [Start database](#start-the-container-for-database)
   2. [Start api](#start-the-container-for-the-api)
4. [Running on Cloud](#running-on-cloud)
   1. [Start database instance](#instance-for-database)
   2. [Start api instance](#instance-for-api)
5. [Api Specs](#api-specification)
6. [Generating JWT Secret](#generating-jwt-secret)

## Reelfake REST API

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
You can go through the [api specs](https://reelfake.cloud/api/docs) for more information.
So, what this api provide?
1. All GET methods (like `/api/movies`, `/api/actors`, `/api/customers`, `/api/movies/:id` and so on).
2. The login (`/api/auth/login`) and logout (`/api/auth/logout`).
3. The new user registration endpoints (i.e. `/api/customers/register` and `/api/staff/register`).
4. Endpoints for forgotten password (i.e. `/api/customers/:id/forgot_password` and `/api/staff/:id/forgot_password`).
5. Endpoints for changing password (i.e. `/api/customers/:id/change_password` and `/api/staff/:id/change_password`).

**Notes:**
1. Although the api is for public, I purge the database weekly to keep my Lightsail instances clean and lightweight.
2. When I purge the database, I re-seed the database which are part of the docker image. So, whatever you created the users or any data will be removed.

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
-e REELFAKE_USERS_DB_NAME=true -e JWT_SECRET={{Generated JWT Secret}} pratapreddy15/reelfake-backend</code></pre>

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
   <pre><code>docker run -d --name container_name_of_choice -p port_of_choice:8080 -e DB_HOST={{IP Address}} \
   -e DB_PORT=5432 -e DB_NAME=reelfake_db -e DB_USER=db_username_prod -e DB_PASSWORD=db_user_password_prod \
   -e REELFAKE_USERS_DB_NAME=true -e JWT_SECRET={{Generated JWT Secret}} pratapreddy15/reelfake-backend</code></pre>

**Note:**

1. The docker command as for deploying to Lightsail is same as running it locally. You will just need to change the DB_HOST for the api which must point to the database instance.
2. AWS keeps improving so the steps above might or might not change in future. Follow [Create a Lightsail Instance](https://docs.aws.amazon.com/lightsail/latest/userguide/how-to-create-amazon-lightsail-instance-virtual-private-server-vps.html) for guidance.

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
