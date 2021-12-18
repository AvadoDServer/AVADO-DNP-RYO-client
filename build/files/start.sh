#!/bin/bash

# echo "Starting nginx"
# nginx -c /etc/nginx/nginx.conf 

echo "Starting haproxy"
/etc/init.d/haproxy start

echo "Starting supervisord"
#start supervisord
supervisord -c /etc/supervisord.conf

# clean up..
rm -f /zt-data/authtoken.secret_
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


echo "Start scanning HAProxy config..."
while :
do
    FILE=/etc/haproxy/newconfig.available
    if test -f "$FILE"; then
        echo "reloading haproxy"
        if test -f "/etc/haproxy/newconfig"; then
            rm -f /etc/haproxy/newconfig.available
            mv "/etc/haproxy/newconfig" /etc/haproxy/haproxy.cfg
            echo "new haproxy config"
            cat /etc/haproxy/haproxy.cfg
            echo "restarting haproxy"
            /etc/init.d/haproxy reload
            sleep 5
        fi
    fi   
    sleep 5
done
