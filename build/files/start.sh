#!/bin/bash

echo "Starting nginx"
nginx -c /etc/nginx/nginx.conf 

echo "Starting haproxy"
/etc/init.d/haproxy start

echo "Starting ZeroTier daemon"

# clean up..
rm /zt-data/authtoken.secret_
mkdir -p /data/acloud/config

# Show that there is a TUN device available
ls -lR /dev/net/tun

FILE=/zt-data/authtoken.secret
while [ ! -f $FILE ]
do
    echo "waiting for zeroTier to start up ($FILE)"
    sleep 2
done

echo "Found ZT secret"
cp $FILE /zt-data/authtoken.secret_
chmod 644 /zt-data/authtoken.secret_

ls -l /zt-data


echo "Starting supervisord daemon"
#start supervisord
supervisord -c /etc/supervisord.conf

echo "Start scanning HAProxy config..."
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
