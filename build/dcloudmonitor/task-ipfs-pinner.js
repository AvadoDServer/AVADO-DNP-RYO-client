const schedule = require('node-schedule');
const axios = require("axios");
const IPFS = require('ipfs-http-client');
const ipfs = new IPFS({ host: 'my.ipfs.dnp.dappnode.eth', port: 5001, protocol: 'http' });

const endpoint = process.env.ACLOUD_ENDPOINT || "http://localhost:5003";

const peerConnect = (peer) => {
    console.log(`Connecting to peer ${peer}`);
    return axios
        .get(
            `http://my.ipfs.dnp.dappnode.eth:5001/api/v0/swarm/connect?arg=${peer}`
        )
        .then(res => {
            //console.log(res);
            console.log(`Connected to peer ${peer}`);
        })
        .catch(error => {
            console.log(`Failed to connect to peer ${peer} : ${error.message}`);
        });
};

const runSchedule = () => {
    console.log("start IPFS pinner.")
    axios.get(`${endpoint}/pininfo`).then(async (res) => {
        let payload = res.data;
        console.log(payload);

        // connect to some peers
        if (payload.ipfspeers) {
            console.log("Received some IPFS peers. Connect to them first.")
            await Promise.all(payload.ipfspeers.map((peer) => { return peerConnect(peer) }));
        }

        // pin hashes
        if (payload.pinroot) {
            ipfs.cat(payload.pinroot, (err, result) => {
                const pinmanifest = JSON.parse(result);
                console.log("pinmanifest=", pinmanifest);
                if (pinmanifest && pinmanifest.pinned) {

                    pinmanifest.pinned.map(async (pin) => {
                        console.log(`pinning ${pin.hash}`);
                        await ipfs.pin.add(pin.hash);
                    });

                    console.log(`pinning ready`);
                }
                if (pinmanifest && pinmanifest.unpinned) {
                    pinmanifest.unpinned.map(async (pin) => {
                        console.log(`unpinning ${pin.hash}`);
                        await ipfs.pin.rm(pin.hash);
                    });
                }
            })
        }

    })
};

let enabled = false;

const j = schedule.scheduleJob('*/1 * * * *', function () {
    if (enabled) {
        runSchedule();
    }
});

module.exports = {
    start: () => { console.log("starting IPFS task"); enabled = true },
    stop: () => { console.log("stopping IPFS task"); enabled = false }
}


