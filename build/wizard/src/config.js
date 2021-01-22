const configs = {
    development: {
        name: 'dev',
        dcloudmonitor: {
            URL: 'http://my.ryo-client.avado.dnp.dappnode.eth:82',
        },
        packageName: "ryo-client.avado.dnp.dappnode.eth",
        autobahn: {
            url: "ws://my.wamp.dnp.dappnode.eth:8080/ws",
            realm: "dappnode_admin",
        }
    }
    ,

    production: {
        name: 'prod',
        dcloudmonitor: {
            URL: 'http://my.ryo-client.avado.dnp.dappnode.eth:82',
        },
        packageName: "ryo-client.avado.dnp.dappnode.eth",
        autobahn: {
            url: "ws://my.wamp.dnp.dappnode.eth:8080/ws",
            realm: "dappnode_admin",
        }
    },
};
const config = process.env.REACT_APP_STAGE
    ? configs[process.env.REACT_APP_STAGE]
    : configs.development;

module.exports = config;
