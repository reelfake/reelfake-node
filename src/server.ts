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
