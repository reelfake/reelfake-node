FROM node:24-alpine3.22

RUN corepack enable

WORKDIR /app

COPY .yarnrc.yml tsconfig.json package.json yarn.lock webpack.dev.config.js webpack.prod.config.js .env.dev .env.test .env.prod ./

RUN yarn cache clean && yarn install

COPY . .

RUN yarn generate-api-specs
RUN yarn build

EXPOSE 8000 443

CMD ["yarn", "start"]