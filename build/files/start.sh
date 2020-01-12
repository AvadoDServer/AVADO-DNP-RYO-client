#!/bin/bash

echo "Starting nginx"
nginx -c /etc/nginx/nginx.conf 

echo "Starting haproxy"
/etc/init.d/haproxy start

echo "Starting ZeroTier daemon"

ls -lR /dev/net/tun

#zerotier-one
supervisord -c /etc/supervisord.conf

FILE=/zt-data/authtoken.secret
while [ ! -f $FILE ]
do
    echo "waiting for zeroTier to start up ($FILE)"
 
    sleep 2
done

cp $FILE /zt-data/authtoken.secret_
chmod 644 /zt-data/authtoken.secret_

ls -l /zt-data

mkdir -p /data/acloud/config

node /usr/dcloudmonitor/index.js "/data/acloud/config" /etc/haproxy/newconfig /zt-data/authtoken.secret_ &

while :
do
    FILE=/etc/haproxy/newconfig
    if test -f "$FILE"; then
        echo "reloading haproxy"
        mv $FILE /etc/haproxy/haproxy.cfg
        /etc/init.d/haproxy reload
        sleep 5
    fi   
    sleep 5
done
