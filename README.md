# Table of Contents
1. [Introduction](#reelfake-rest-api)
2. [Running locally](#running-on-localhost)
   1. [Start database](#start-the-container-for-database)
   2. [Start api](#start-the-container-for-the-api)
3. [Running on Cloud](#running-on-cloud)
   1. [Start database instance](#instance-for-database)
   2. [Start api instance](#instance-for-api)
4. [Api Specs](#api-specification)

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

## Running on localhost

### Start the container for database
docker run -d --name container_name_of_choice -p 5432:5432 -v volume_name_of_choice:/var/lib/postgresql/data \
-e POSTGRES_USER=username_of_choice -e POSTGRES_PASSWORD=password_of_choice pratapreddy15/reelfake-postgres

#### Verify the database is up
docker logs -f container_name_from_above

### Start the container for the api
docker run -d --name container_name_of_choice -p port_of_choice:8080 -e NODE_ENV=production -e DB_HOST=172.17.0.2 \
-e DB_PORT=5432 -e DB_NAME=reelfake_db -e DB_USER=username_from_above -e DB_PASSWORD=password_from_above \
-e REELFAKE_USERS_DB_NAME=true pratapreddy15/reelfake-backend

#### Monitor the api logs (if REELFAKE_USERS_DB_NAME is enabled then you can see the db transaction related logs)
docker logs -f container_name_from_above

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
2. Once created, go to Networking tab
3. Make sure below rules are added (or add if missing)
   - SSH on port 22
   - HTTP on port 80
4. SSH into the in instance
5. Run the docker command which is same as in [Run Database](#start-the-container-for-database)

### Instance for api
1. The steps from 1 to 4 are same as database instance.
2. Run the docker for starting api which is same as [Run API](#start-the-container-for-the-api)

**Note:**
1. The docker command as for deploying to Lightsail is same as running it locally. You will just need to change the DB_HOST for the api which must point to the database instance.
2. AWS keeps improving so the steps above might or might not change in future. Follow [Create a Lightsail Instance](https://docs.aws.amazon.com/lightsail/latest/userguide/how-to-create-amazon-lightsail-instance-virtual-private-server-vps.html) for guidance.

## Api Specification

*If running locally (the port is what you mentioned when running the container)*
Docs - http://localhost:{{port}}/api/docs
Redocs - http://localhost:{{port}}/api/redocs

*If running on cloud*
Docs - http://{{Ip Address or host DNS}}/api/docs
Redocs - http://{{Ip Address or host DNS}}/api/redocs

## License

MIT
