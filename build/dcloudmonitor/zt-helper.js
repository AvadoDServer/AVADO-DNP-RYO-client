const Service = require('zerotier-service');

class ZtHelper {
    constructor(authToken) {
        this._service = new Service({ authToken });
    }
    get service() {
        return this._service;
    }

    // get the local address of this ZT node
    async getAddress() {
        try {
            const res = await this._service.status();
            if (!res.body || !res.body.address) {
                return null;
            } else {
                return res.body.address;
            }
        } catch (e) {
            console.error(`Error getAddress`, e.message);
            return null;
        }
    }

    async getNetworks() {
        try {
            const res = await this._service.networks();
            return res.body;
        } catch (e) {
            console.error(e.message);
            return [];
        }
    }

    async amIinNetwork(networkId) {
        const networks = await this.getNetworks();
        if (!networks || !Array.isArray(networks)) {
            return false;
        } else {
            return ((networks.findIndex((item) => { return item.id === networkId })) !== -1)
        }
    }

    async leaveAllNetworks() {
        const networks = await this.getNetworks();
        if (networks && Array.isArray(networks)) {
            return networks.map(async (network) => {
                console.log(`Leaving network ${network.id}`)
                await this._service.leave(network.id);
            })
        }
    }

    async join(networkId) {
        const joined = await this.amIinNetwork(networkId);
        if (joined) {
            return console.log(`Already in network ${networkId}`)
        }
        return this._service.join(networkId);
    }

    async leave(networkId) {
        const joined = await this.amIinNetwork(networkId);
        if (!joined) {
            return console.log(`Not in network ${networkId}`)
        }
        return this._service.leave(networkId);
    }


    // sayHello() {
    //     console.log('Hello, my name is ' + this.name + ', I have ID: ' + this.id);
    // }
}

module.exports = ZtHelper;
