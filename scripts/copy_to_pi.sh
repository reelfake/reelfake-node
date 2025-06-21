scp -r ../.env.* predd@dockerpi:./reelfake-api
scp -r ../webpack.*.config.js predd@dockerpi:./reelfake-api
scp ../package.json predd@dockerpi:./reelfake-api
scp ../yarn.lock predd@dockerpi:./reelfake-api
scp ../tsconfig.json predd@dockerpi:./reelfake-api
scp ../.yarnrc.yml predd@dockerpi:./reelfake-api
scp ../.dockerignore predd@dockerpi:./reelfake-api
scp ../Dockerfile predd@dockerpi:./reelfake-api
scp ../docker-compose.yaml predd@dockerpi:./reelfake-api
scp -r ../config predd@dockerpi:./reelfake-api/config
scp -r ../src predd@dockerpi:./reelfake-api
scp -r ../openapi predd@dockerpi:./reelfake-api/openapi

# docker build -t reelfake-postgres .
# docker run -p 5432:5432 -it --rm -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=<<password>> --name reelfake-db reelfake-postgres postgres -c max_wal_size=4GB -c shared_preload_libraries=pg_cron -c cron.database_name=reelfake_db_dev


# docker build -t reelfake .
# docker run -d --rm --name reelfake-api -p 8000:8000 reelfake

# sudo apt update
# sudo apt upgrade

# sudo apt install ufw

# sudo ufw allow 22
# sudo ufw allow 8000

# sudo ufw enable
# sudo ufw status

# sudo ufw disable