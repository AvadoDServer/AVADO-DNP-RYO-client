const fs = require('fs');
const authToken = fs.readFileSync("/tmp/authtoken.secret", 'utf8');
const ZtHelper = require('./zt-helper');
const ztHelper = new ZtHelper(authToken);

const test = async () => {
    console.log(await ztHelper.getAddress());
    console.log(await ztHelper.getNetworks());
    // await ztHelper.leaveAllNetworks();
    // console.log(await ztHelper.getNetworks());

    await ztHelper.join("1d7193940437440b");
    console.log(await ztHelper.getNetworks());

    await ztHelper.join("e5cd7a9e1cdf81f3");
    console.log(await ztHelper.getNetworks());

    await ztHelper.leave("e5cd7a9e1cdf81f3");
    await ztHelper.leave("1d7193940437440b");
    await ztHelper.leave("1d7193940437440b");
    console.log(await ztHelper.getNetworks());

        // console.log(await ztHelper.amIinNetwork("e5cd7a9e1cdf81f3"));
    // console.log(await ztHelper.amIinNetwork("1d7193940437440b"));



//    



}

test();