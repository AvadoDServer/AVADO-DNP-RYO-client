// const EventEmitter = require('events');
// class MyEmitter extends EventEmitter { }
// const events = new MyEmitter();
const config = require("config");
const models = require("./models");
const IPFS = require('ipfs-mini');
const ipfs = new IPFS(config.ipfshost);
const ethers = require("ethers");
const provider = new ethers.providers.JsonRpcProvider(config.ethers.jsonproviderurl);

module.exports = (server) => {
    const indexTxHash = async (txhash) => {