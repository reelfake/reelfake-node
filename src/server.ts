import app from './app';

const port = process.env.PORT || 8000;

app.listen(port, () => {
  console.log(` Reelfake api is running on port ${port}`);
});

// sudo dnf update -y
// sudo yum install -y docker
// sudo systemctl start docker
// sudo systemctl enable docker
// sudo usermod -aG docker $USER
