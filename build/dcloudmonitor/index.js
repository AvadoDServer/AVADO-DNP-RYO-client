const chokidar = require('chokidar');
const fs = require('fs');
const axios = require('axios');
const path = require("path");
const restify = require("restify");
const corsMiddleware = require("restify-cors-middleware");
// const Service = require('zerotier-service');
const ZtHelper = require('./zt-helper');


// configFilePath should be the full filename
const configFilePath = process.argv[2];
const newHAProxyConfigFile = process.argv[3];
const authTokenFilePath = process.argv[4];
const taskIpfsPinner = require('./task-ipfs-pinner');

let keepaliveTimer;
let lastPing;
let lastConfig;

const endpoint = process.env.ACLOUD_ENDPOINT || "http://localhost:5003";


if (!configFilePath || !newHAProxyConfigFile || !authTokenFilePath) {
    console.log("please provide");
    console.log("-folder where to watch for new config files from wizard UI");
    console.log("-filename where to write new HAProxy file");
    console.log("-ZT auth token filename");
    process.exit();
}

if (!fs.existsSync(authTokenFilePath)) {
    console.log(`${authTokenFilePath} does not exist`);
    process.exit();
}

let myZtAddress;
let ztHelper;

const start = async () => {


    console.log(`Reading ZT token ${authTokenFilePath}`);
    // Get ZT auth token to create & manage networks
    const authToken = fs.readFileSync(authTokenFilePath, 'utf8');

    // ZT service manages network connections
    // const service = new Service({ authToken });
    ztHelper = new ZtHelper(authToken);

    myZtAddress = await ztHelper.getAddress();

    if (!myZtAddress) {
        console.log("fatal: Cannot find my ZT address.");
        process.exit();
    }



    console.log(`OK: myZtAddress=${myZtAddress}`);

    console.log("Cloudmonitor starting...");
    console.log("API endpoint:", endpoint);
    console.log(`watching path ${configFilePath}`);
    console.log(`writing to ${newHAProxyConfigFile}`);

    axios.get(`${endpoint}/ping`)
        .then((res) => {
            console.log(`${endpoint} is online`);
        }).catch((e) => {
            console.log(`${endpoint} is offline`);
        });

    chokidar.watch(configFilePath)
        .on("add", (path) => {
            console.log(`chokidar discovered new file ${path}`);
            parse(path);
        }).on("change", (path) => {
            console.log(`chokidar discovered modified file ${path}`);
            parse(path);
        });

    const configFile = `${configFilePath}/registration.json`;
    if (fs.existsSync(configFile)) {
        console.log("config file found");
        parse(configFile);
    } else {
        console.log("No Config file found yet");
    }


    console.log("starting server");

    const server = restify.createServer({
        name: "AVADO A-CLOUD API",
        version: "1.0.1"
    });

    const cors = corsMiddleware({
        preflightMaxAge: 5, //Optional
        origins: [
            /^http:\/\/localhost(:[\d]+)?$/,
            "http://*.dappnode.eth:81",
            "http://my.ryo-client.avado.dnp.dappnode.eth:81"
        ]
    });

    server.pre(cors.preflight);
    server.use(cors.actual);

    server.get("/pool", function (req, res, next) {
        axios.get(`${endpoint}/acloud/pool`)
            .then((r) => {
                res.send(200, r.data)
            }).catch((e) => {
                res.send(500, e.message);
            });
    })

    server.get("/status", function (req, res, next) {
        Promise.all([ztHelper.getNetworks(), ztHelper.getAddress()]).then(([networks, address]) => {

            axios.get(`${endpoint}/memberstatus/${address}`)
                .then((r) => {
                    return res.send(200, {
                        networks: networks,
                        address: address,
                        lastPing: lastPing,
                        registration: lastConfig,
                        acloudstatus: r.data,
                        haproxyconfig: (lastConfig && lastConfig.config && lastConfig.config.sharedservices) ? configtoHAProxyConf(lastConfig.config.sharedservices) : null
                    });

                }).catch((e) => {
                    res.send(500, e.message);
                });




        }).catch((e) => {
            console.log("Error getting stats", e);
        });
    });

    server.listen(82, function () {
        console.log("%s listening at %s", server.name, server.url);
    });

}


const getIP = (networks) => {
    if (networks && networks[0] && networks[0].assignedAddresses
    && networks[0].assignedAddresses[0])
    {
     return networks[0].assignedAddresses[0].split("/")[0];
    }
    return "0.0.0.0"

    }

// creates a new HAProxy conf based on the A-cloud config json data
const configtoHAProxyConf = async config => {


    const networks = ztHelper.getNetworks();
    const frontendIP = getIP(networks);

    console.log(`frontend IP=${frontendIP}`);


    const configStr =
        `\
global\n\
defaults\n\
timeout client          300s\n\
timeout server          300s\n\
timeout connect         300s\n\
\n

` +
        config.reduce((accum, item, i) => {
            for (let p = 0; p < item.ports.length; p++) {
                const key = `service_${item.hostname.replace(/\./g, "_").replace(/\-/g, "_")}_${i}_${p}`;
                const line = `\n\
                frontend ${key} \n\
                bind    ${frontendIP}:${item.frontendports ? item.frontendports[p] : item.ports[p]} \n\
                default_backend ${key}_backend \n\
                \n\
                backend ${key}_backend \n\
                mode    tcp \n\
                server upstream ${item.hostname}:${item.ports[p]} \n\
                \n\
                `;
                accum += line;
            }
            return accum;
        }, "");
    return configStr;
}

// parses new config file and posts presence to acloud LB
const parse = async path => {
    console.log(`Loading ${path}`);
    fs.readFile(path, 'utf8', async (err, jsonString) => {
        if (err) {
            console.log("Error reading file from disk:", err)
            return
        }
        try {
            const config = JSON.parse(jsonString);
            console.log("received new config");
            console.log(JSON.stringify(config, 0, 2));

            const haProxyConfigString = await configtoHAProxyConf(config.sharedservices);

            console.log("Created new HAProxy config");
            console.log("-------------------<<<--------------------");
            console.log(haProxyConfigString);
            console.log("------------------->>>--------------------");

            fs.writeFile(newHAProxyConfigFile, haProxyConfigString, err => {
                if (err) {
                    console.error(err);
                    return;
                }
                fs.writeFile(`${newHAProxyConfigFile}.available`, "ok", err => {
                    console.log(`Config file written to ${newHAProxyConfigFile}`);
                    console.log(haProxyConfigString)
                });
            });
            postConfig(config);

            const pinnerEnabled = config.sharedservices.find((s) => { return s.key === "ipfs_pinner" })

            if (pinnerEnabled) {
                console.log("pinning scheduler: enabled")
                taskIpfsPinner.start();
            } else {
                console.log("pinning scheduler: disabled")
                taskIpfsPinner.stop();
            }
        } catch (err) {
            console.log('Error parsing JSON string:', err, jsonString);
        }
    })
};

// post config to acloud LB
const postConfig = (config) => {
    if (keepaliveTimer) {
        clearInterval(keepaliveTimer);
    }

    console.log("config", JSON.stringify(config, 0, 2));
    lastConfig = { memberid: myZtAddress, config: config, version: "0.0.1" };
    axios.post(`${endpoint}/acloud/connect`, lastConfig)
        .then(async (res) => {
            console.log("configuration succesfully sent to acloud");
            if (!res.data || !res.data.networkid || !res.data.keepaliveinterval) {
                console.log("Did not receive enough information from server to proceed.", res.data);
                return;
            }

            const networkId = res.data.networkid;
            const keepAliveInterval = res.data.keepaliveinterval;

            console.log(`joining network ${networkId}`);

            await ztHelper.join(networkId);
            if (ztHelper.amIinNetwork(networkId)) {
                console.log(`OK: joined network ${networkId}`);
                const intervalDuration = keepAliveInterval || 1000 * 60 * 5;
                console.log(`keepalive interval set to ${intervalDuration}`);
                keepaliveTimer = setInterval(() => {
                    console.log(`announcing keepalive ${myZtAddress}`);
                    axios.get(`${endpoint}/acloud/keepalive/${myZtAddress}`).then((res) => {
                        console.log(`keepalive successful.`);
                        lastPing = res.data;
                    }).catch((e) => {
                        console.log(`keepalive not successful.`, e);
                        lastPing = null;
                    });
                }, intervalDuration);
            } else {
                console.log(`ERROR: Failed to join network ${networkId}`)
            }

        }).catch((e) => {
            console.log("Authentication failed or network error", e);
        });

};



start();