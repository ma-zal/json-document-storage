FROM node:18-alpine as build

# HTTP server
EXPOSE 3000/tcp

# Create /app/server directory
RUN mkdir -p /app/dist/client && \
    mkdir -p /app/src/server

# Install deps. Note: Deps are shared across client&server.
COPY package.json yarn.lock /app/
RUN cd /app && \
    yarn install && \
    yarn cache clean --all

ARG NG_CLI_ANALYTICS="false"

# Build Client Apps
COPY /src/common /app/src/common
COPY /src/client /app/src/client
RUN cd /app/src/client && yarn build

# Build Server App
COPY src/server /app/src/server
RUN cd /app/src/server && \
    yarn build
# `tsconfig.json` is required by `tsconfig-paths` lib.
COPY src/server/tsconfig.json /app/dist/server/


# ----- Production image -----

FROM node:18-alpine AS production

# Install production dependencies
COPY package.json yarn.lock /app/
RUN cd /app && \
    yarn install --production && \
    yarn cache clean --all
# Copy final app build
COPY --from=build /app/dist /app/dist
# Run app
WORKDIR /app/dist/server
CMD ["node", "--enable-source-maps", "-r", "tsconfig-paths/register", "app"]
