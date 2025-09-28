FROM node:24-alpine3.22

WORKDIR /app

RUN corepack enable

COPY .yarnrc.yml tsconfig.json package.json yarn.lock webpack.prod.config.js .env.prod ./

RUN yarn cache clean && yarn install

COPY . .

RUN yarn generate-api-specs
RUN yarn build

EXPOSE 80 443

CMD ["yarn", "start"]