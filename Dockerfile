FROM node:22-bookworm-slim

RUN corepack enable

WORKDIR /app

COPY .yarnrc.yml tsconfig.json package.json yarn.lock webpack.dev.config.js webpack.prod.config.js .env.dev .env.test .env.prod ./

RUN yarn cache clean && yarn install

COPY ./src ./src

RUN yarn build

EXPOSE 8000

CMD ["yarn", "start"]