#!/bin/bash

echo "Starting nginx"
nginx -c /etc/nginx/nginx.conf 

echo "Starting haproxy"
/etc/init.d/haproxy start

echo "Starting ZeroTier daemon"

ls -lR /dev/net/tun

#/usr/sbin/zerotier-one &

#zerotier-one
supervisord -c /etc/supervisord.conf

# echo "Joining network $NETWORK_ID"

# [ ! -z $NETWORK_ID ] && { sleep 5; zerotier-cli join $NETWORK_ID || exit 1; }

# waiting for Zerotier IP
# why 2? because you have an ipv6 and an a ipv4 address by default if everything is ok
# ZTIP=""
# while [ -z "$ZTIP" ]
# do
#   ZTDEV=$( ip addr | grep -i zt | grep -i mtu | awk '{ print $2 }' | cut -f1 -d':' )
#   ZTIP=$( ip -4 addr show $ZTDEV | grep -oP '(?<=inet\s)\d+(\.\d+){3}' )
#   if [ -z "$ZTIP" ]
#   then
#       echo "Waiting for a ZeroTier IP on $ZTDEV interface... "
#       sleep 5
#   fi
# done
# echo "OK - your your ZeroTier IP is: $ZTIP"

mkdir -p /data/acloud/config

node /usr/dcloudmonitor/index.js "/data/acloud/config" /etc/haproxy/newconfig &

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
