FROM node:16-buster as build
ENV DOCKER=true
RUN curl -sL https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -
RUN echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list
RUN apt update && apt -y install yarn

WORKDIR /app

COPY package.json .yarnrc.yml yarn.lock .pnp.cjs ./
COPY .yarn .yarn

RUN yarn

COPY . .

RUN yarn build


# stage 2
FROM node:16-buster
ENV DOCKER=true
RUN curl -sL https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -
RUN echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list
RUN apt update && apt -y install yarn

WORKDIR /app

# COPY --from=build /app/assets assets
COPY --from=build /app/package.json /app/.yarnrc.yml /app/yarn.lock /app/.pnp.cjs ./
COPY --from=build /app/.yarn .yarn
COPY --from=build /app/dist /app/dist

CMD [ "yarn", "prod" ]
