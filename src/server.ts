import app from './app';

const port = process.env.PORT || 8000;

app.listen(port, () => {
  console.log(` Reelfake api is running on port ${port}`);
});
