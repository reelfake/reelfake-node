import app from './app';
import { DEFAULT_PORT } from './constants';

const port = process.env.PORT || DEFAULT_PORT;

app.listen(port, () => {
  console.log(` Reelfake api is running on port ${port}`);
});
