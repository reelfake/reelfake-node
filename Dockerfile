FROM node:24.9-slim AS build

WORKDIR /app

RUN corepack enable

COPY .yarnrc.yml tsconfig.json package.json yarn.lock webpack.prod.config.js ./

RUN yarn cache clean && yarn install

COPY . .

RUN yarn generate-api-specs
RUN yarn build

FROM node:24.9-slim

WORKDIR /app

COPY --from=build /app/dist/server.js ./

EXPOSE 8080 8000

CMD [ "node", "server.js" ]