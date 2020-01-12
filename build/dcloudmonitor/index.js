const chokidar = require('chokidar');
const fs = require('fs');
const axios = require('axios');
const path = require("path");
const restify = require("restify");
const corsMiddleware = require("restify-cors-middleware");
const Service = require('zerotier-service');

// configFilePath should be the full filename
const configFilePath = process.argv[2];
const newHAProxyConfigFile = process.argv[3];
const authTokenFilePath = process.argv[4];

const taskIpfsPinner = require('./task-ipfs-pinner');

let keepaliveTimer;
let lastPing;
let lastConfig;

const endpoint = process.env.ACLOUD_ENDPOINT || "http://localhost:5003";

// Get ZT auth token to create & manage networks
const authToken = fs.readFileSync(authTokenFilePath, 'utf8');

// ZT controller manages creating networks & managing members
// const controller = new Controller({ authToken });

// ZT service manages network connections
const service = new Service({ authToken });

if (!configFilePath || !newHAProxyConfigFile) {
    console.log("please provide");
    console.log("-folder where to watch for new config files from wizard UI");
    console.log("-filename where to write new HAProxy file");
    process.exit();
}

// creates a new HAProxy conf based on the A-cloud config json data
const configtoHAProxyConf = config => {
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
            const key = `service_${item.hostname.replace(/\./g, "_").replace(/\-/g, "_")}${i}`;
            for (let p = 0; p < item.ports.length; p++) {
                const line = `\
                frontend ${key} \n\
                bind    0.0.0.0:${item.frontendports ? item.frontendports[p] : item.ports[p]} \n\
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
const parse = path => {
    console.log(`Loading ${path}`);
    fs.readFile(path, 'utf8', (err, jsonString) => {
        if (err) {
            console.log("Error reading file from disk:", err)
            return
        }
        try {
            const config = JSON.parse(jsonString);
            console.log("received new config");
            console.log(JSON.stringify(config, 0, 2));

            const haProxyConfigString = configtoHAProxyConf(config.sharedservices);

            console.log("Created new HAProxy config");
            console.log("-------------------<<<--------------------");
            console.log(haProxyConfigString);
            console.log("------------------->>>--------------------");

            fs.writeFile(newHAProxyConfigFile, haProxyConfigString, err => {
                if (err) {
                    console.error(err);
                    return;
                }
                console.log(`Config file written to ${newHAProxyConfigFile}`);
                console.log(haProxyConfigString)
            });
            postConfig(config);

            const pinnerEnabled = config.sharedservices.find((s)=>{return s.key === "ipfs_pinner"})

            if (pinnerEnabled){
                console.log("pinning scheduler: enabled")
                taskIpfsPinner.start();
            }else{
                console.log("pinning scheduler: disabled")
                taskIpfsPinner.stop();
            }


            // receivedConfig = true;
        } catch (err) {
            console.log('Error parsing JSON string:', err, jsonString);
        }
    })
};

// get the local address of this ZT node
const ztGetAddress = () => {
    return new Promise(async (resolve, reject) => {
        console.log("ztGetAddress");
        try {
            const res = await service.status();
            if (!res.body || !res.body.address) {
                return resolve("");
            } else {
                return resolve(res.body.address);
            }
        } catch (e) {
            return reject(e);
        }
    });
}

const ztGetNetworks = () => {
    return new Promise(async (resolve, reject) => {
        console.log("ztGetNetworks");
        try {
            const res = await service.networks();
            return resolve(res.body);
        } catch (e) {
            return reject(e);
        }
    });
}


// join a ZT network
const ztJoinNetwork = (networkid) => {
    return new Promise((resolve, reject) => {
        service.join(networkid, (e) => {
            if (e) {
                return reject(e);
            }
            return resolve();
        });
    });
}


// post config to acloud LB
const postConfig = (config) => {
    if (keepaliveTimer) {
        clearInterval(keepaliveTimer);
    }
    ztGetAddress().then((myZtAddress) => {
        console.log("myZtAddress", myZtAddress);
        console.log("config", JSON.stringify(config, 0, 2));
        lastConfig = { memberid: myZtAddress, config: config, version: "0.0.1" };
        axios.post(`${endpoint}/acloud/connect`, lastConfig)
            .then((res) => {
                console.log("configuration succesfully sent to acloud");
                if (!res.data || !res.data.networkid) {
                    console.log("Did not receive enough information from server to proceed.", res.data);
                    return;
                }
                console.log(`joining network`, res.data);
                ztJoinNetwork(res.data.networkid).then(() => {
                    console.log("ok joined network...");
                    const intervalDuration = res.data.keepaliveinterval || 1000 * 60 * 5;
                    console.log(`keepalive interval set to ${intervalDuration}`);
                    keepaliveTimer = setInterval(() => {
                        console.log("announcing keepalive");
                        axios.get(`${endpoint}/acloud/keepalive/${myZtAddress}`).then((res) => {
                            console.log(`keepalive successful.`);
                            lastPing = res.data;
                        }).catch((e) => {
                            console.log(`keepalive not successful.`, e);
                            lastPing = null;
                        });
                    }, intervalDuration);
                }).catch((e) => {
                    // what now ?
                    console.log("Error joining ZT network", e);
                });
                // console.log(res);
            }).catch((e) => {
                console.log("Authentication failed or network error", e);
            });
    })
};

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


console.log("starting server");

const server = restify.createServer({
    name: "AVADO A-CLOUD API",
    version: "1.0.0"
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
        res.send(200,r.data)
    }).catch((e) => {
        res.send(500,e.message);
    });
})

server.get("/status", function (req, res, next) {
    Promise.all([ztGetNetworks(), ztGetAddress()]).then(([networks, address]) => {
        return res.send(200, {
            networks: networks,
            address: address,
            lastPing: lastPing,
            registration: lastConfig,
            haproxyconfig: (lastConfig && lastConfig.config && lastConfig.config.sharedservices) ? configtoHAProxyConf(lastConfig.config.sharedservices) : null
        });
    }).catch((e) => {
        console.log("Error getting stats", e);
    });
});

server.listen(82, function () {
    console.log("%s listening at %s", server.name, server.url);
});