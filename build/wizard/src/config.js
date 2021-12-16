const configs = {
    development: {
        name: 'dev',
        dcloudmonitor: {
            URL: 'http://ryo-client.my.ava.do:82',
        },
        packageName: "ryo-client.avado.dnp.dappnode.eth",
        autobahn: {
            url: "ws://wamp.my.ava.do:8080/ws",
            realm: "dappnode_admin",
        }
    }
    ,

    production: {
        name: 'prod',
        dcloudmonitor: {
            URL: 'http://ryo-client.my.ava.do:82',
        },
        packageName: "ryo-client.avado.dnp.dappnode.eth",
        autobahn: {
            url: "ws://wamp.my.ava.do:8080/ws",
            realm: "dappnode_admin",
        }
    },
};
const config = process.env.REACT_APP_STAGE
    ? configs[process.env.REACT_APP_STAGE]
    : configs.development;

module.exports = config;
