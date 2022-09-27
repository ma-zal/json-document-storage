FROM node:18-alpine

# HTTP server
EXPOSE 3000/tcp

# Create /app/server directory
RUN mkdir -p /app/dist/client && \
    mkdir -p /app/src/server

# Install deps. Note: Deps are shared across client&server.
COPY package.json yarn.lock /app/
WORKDIR /app
RUN yarn install && yarn cache clean --all

# Build Client Apps
COPY /src/common /app/src/common
COPY /src/client /app/src/client
RUN cd /app/src/client && yarn build

# Build Server App
COPY src/server /app/src/server
WORKDIR /app/src/server
RUN yarn build
# `tsconfig.json` is required by `tsconfig-paths` lib.
COPY src/server/tsconfig.json /app/dist/server/


# Run app
WORKDIR /app/dist/server
CMD ["node", "--enable-source-maps", "-r", "tsconfig-paths/register", "app"]
