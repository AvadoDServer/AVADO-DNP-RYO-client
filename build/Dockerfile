FROM node:10.15.3 as build-deps-wizard
RUN apt-get update && apt-get install -y jq

# Generate SSL certificates
# WORKDIR /usr/src/cert
# RUN openssl genrsa -des3 -passout pass:avadopass -out server.pass.key 2048 && \
#     openssl rsa -passin pass:avadopass -in server.pass.key -out server.key && \
#     rm server.pass.key && \
#     openssl req -new -key server.key -out server.csr \
#         -subj "/C=CH/ST=Zug/L=Zug/O=AVADO/OU=Decentralization Dpt/CN=my.dcloud-client.avado.dnp.dappnode.eth" && \
#     openssl x509 -req -days 365 -in server.csr -signkey server.key -out server.crt

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

# RUN curl -L -o /tmp/zerotier-install.sh https://install.zerotier.com/ && bash /tmp/zerotier-install.sh || exit 0


FROM ubuntu:xenial
#FROM node:10.15.3-alpine
#FROM node:10.15.3

RUN apt-get update && apt-get install -y curl screen supervisor nginx haproxy
#RUN apk add --no-cache curl openrc nginx bash haproxy supervisor

RUN curl -L -o /tmp/zerotier-install.sh https://install.zerotier.com/ && bash /tmp/zerotier-install.sh || exit 0

# create nginx user
RUN adduser --disabled-password --gecos '' nginx

# get nodejs
RUN curl -sL https://deb.nodesource.com/setup_10.x | bash -
RUN apt-get update && apt-get install nodejs


# COPY --from=build-deps-wizard /usr/sbin/zerotier-one /usr/sbin/zerotier-one 

COPY build/files/supervisord.conf /etc/supervisord.conf
COPY build/files/start.sh /opt/start.sh
RUN chmod 755 /opt/start.sh

# copy files for wizard
COPY build/files/nginx.conf /etc/nginx/nginx.conf
COPY --from=build-deps-wizard /usr/src/app/build /usr/www/wizard
# COPY --from=build-deps-wizard /usr/src/cert/server.crt /etc/nginx/cert.crt
# COPY --from=build-deps-wizard /usr/src/cert/server.key /etc/nginx/cert.key

COPY --from=build-deps-wizard /usr/src/dcloudmonitor /usr/dcloudmonitor

# haproxy
COPY build/files/haproxy.cfg /etc/haproxy/haproxy.cfg

ENTRYPOINT "/opt/start.sh"
