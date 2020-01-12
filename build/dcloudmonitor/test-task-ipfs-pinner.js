const ipfstask = require("./task-ipfs-pinner");

ipfstask.start();

setTimeout(ipfstask.stop,65 * 1000);