import app from './app';
import { DEFAULT_PORT } from './constants';

const port = process.env.NODE_ENV === 'production' ? 8080 : process.env.PORT || DEFAULT_PORT;

app.listen(port, () => {
  console.log(`[Env: ${process.env.NODE_ENV}] Reelfake api is running on port ${port}`);
});
