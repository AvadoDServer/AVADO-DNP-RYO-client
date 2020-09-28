FROM node:10.15.3 as build-deps-wizard
RUN apt-get update && apt-get install -y jq

# build wizard
WORKDIR /usr/src/app
COPY build/wizard .
ADD dappnode_package.json .
RUN ./getVersionData.sh
RUN yarn add react-scripts
RUN rm -Rf build && yarn run build

WORKDIR /usr/src/dcloudmonitor
COPY build/dcloudmonitor .
RUN npm i

FROM ubuntu:xenial

RUN apt-get update && apt-get install -y curl screen supervisor nginx haproxy

RUN curl -L -o /tmp/zerotier-install.sh https://install.zerotier.com/ && bash /tmp/zerotier-install.sh || exit 0

# create nginx user
RUN adduser --disabled-password --gecos '' nginx

# get nodejs
RUN curl -sL https://deb.nodesource.com/setup_10.x | bash -
RUN apt-get update && apt-get install nodejs

COPY build/files/supervisord.conf /etc/supervisord.conf
COPY build/files/start.sh /opt/start.sh
RUN chmod 755 /opt/start.sh

# copy files for wizard
COPY build/files/nginx.conf /etc/nginx/nginx.conf
COPY --from=build-deps-wizard /usr/src/app/build /usr/www/wizard

COPY --from=build-deps-wizard /usr/src/dcloudmonitor /usr/dcloudmonitor

# haproxy
COPY build/files/haproxy.cfg /etc/haproxy/haproxy.cfg

ENTRYPOINT "/opt/start.sh"
