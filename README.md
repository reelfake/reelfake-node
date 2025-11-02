# Reelfake REST API

A rest api that provides data for practicing, prototyping or anything to play with for the frontend development. This api is build with the real sql database so when you update the data is really updated and when you create the data is really created.

You have a simple api with GET, POST, PUT, PATCH and DELETE operations with the cookie based authentication. There is also a csv file upload that uses the server sent events so you can listen to any incoming events on frontend. The file upload also just process the file and send the response and also uses server sent events.

## APIs
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

### Start the container for the api
docker run -d --name container_name_of_choice -p port_of_choice:8080 -e NODE_ENV=production -e DB_HOST=172.17.0.2 \
-e DB_PORT=5432 -e DB_NAME=reelfake_db -e DB_USER=username_from_above -e DB_PASSWORD=password_from_above \
-e REELFAKE_USERS_DB_NAME=true pratapreddy15/reelfake-backend

## License

MIT
