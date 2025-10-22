import app from './app';
import { sequelize_users } from './sequelize.config';
import { DEFAULT_PORT } from './constants';

const port = process.env.NODE_ENV === 'production' ? 8080 : process.env.PORT || DEFAULT_PORT;

sequelize_users
  .sync()
  .then(() => {
    app.listen(port, () => {
      console.log(`[Env: ${process.env.NODE_ENV}] Reelfake api is running on port ${port}`);
    });
  })
  .catch((err) => {
    console.log('Reelfake Users Db connection error', err);
  });

// docker run -d --name reelfake-api -p 8000:8000 -e DB_HOST=localhost -e DB_PORT=5432 -e DB_USER=postgres -e DB_PASSWORD=password_dev -e DB_NAME=reelfake_db -e REELFAKE_USERS_DB_NAME=reelfake_users_db reelfake-backend
