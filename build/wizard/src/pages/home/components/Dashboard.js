import React from "react";
// import { Redirect } from "react-router-dom";
// import styled from "styled-components";
import autobahn from "autobahn-browser";
import QrReader from 'react-qr-reader'
import { Formik, Form, Field, ErrorMessage } from "formik";
import { listPackages } from "../../../util/avado";
import classNames from "classnames";
import axios from "axios";

const url = "ws://my.wamp.dnp.dappnode.eth:8080/ws";
const realm = "dappnode_admin";
const packageName = "acloud-client.avado.dnp.dappnode.eth";
// const dcloudmonitorAPI = "http://my.acloud-client.avado.dnp.dappnode.eth:82/";
const dcloudmonitorAPI = "http://localhost:82";

const packagewhitelist = [
    {
        key: "ethchain_geth",
        packagename: "ethchain-geth.public.dappnode.eth",
        name: "My Ethereum node (geth based)",
        hostname: "my.ethchain-geth.dnp.dappnode.eth",
        ports: [8545],
        description: "You will share the Ethereum RPC endpoint of your AVADO node for others to use. Your node will serve as an endpoint to add transactions to the blockchain - or query blockchain data"
    },
    {
        key: "ethchain_parity",
        packagename: "ethchain.dnp.dappnode.eth",
        name: "My Ethereum node (Parity based)",
        ports: [8545],
        hostname: "my.ethchain.dnp.dappnode.eth",
        description: "You will share the Ethereum RPC endpoint of your AVADO node for others to use. Your node will serve as an endpoint to add transactions to the blockchain - or query blockchain data"
    },
    {
        key: "ipfs_gateway",
        packagename: "ipfs.dnp.dappnode.eth",
        name: "My IPFS node gateway",
        description: "You will share your IPFS gateway - allowing other to get IPFS data through your node",
        hostname: "my.ipfs.dnp.dappnode.eth",
        ports: [8080]
    }
    ,
    {
        key: "ipfs_api",
        packagename: "ipfs.dnp.dappnode.eth",
        name: "My IPFS node gateway API",
        description: "You will share your IPFS API - allowing other to add new IPFS data through your node and pin content on your node",
        hostname: "my.ipfs.dnp.dappnode.eth",
        ports: [5001]
    }
];


const Comp = () => {

    const [wsSession, setWsSession] = React.useState();
    const [savingConfig, setSavingConfig] = React.useState(false);
    const [qr, setQr] = React.useState(false);
    const [packages, setPackages] = React.useState();
    const [pollDocker, setPollDocker] = React.useState(false);
    const [currentConfig, setCurrentConfig] = React.useState(undefined);

    React.useEffect(() => {
        const connection = new autobahn.Connection({
            url,
            realm
        });

        // connection opened
        connection.onopen = session => {
            console.log("CONNECTED to \nurl: " + url + " \nrealm: " + realm);
            setWsSession(session);
            //debugger;
            listPackages(session).then((p) => {

                // create a plain array with installed package names (these are unique)
                const installedpackages = Object.keys(p).map((key) => {
                    return p[key].name;
                });

                const whiteListedPackages = packagewhitelist.reduce((accum, item, i) => {
                    if (installedpackages.includes(item.packagename)) {
                        accum.push(item);
                    }
                    return accum;
                }, []);

                // debugger;
                setPackages(whiteListedPackages);
            })

        };

        // connection closed, lost or unable to connect
        connection.onclose = (reason, details) => {
            console.error("CONNECTION_CLOSE", { reason, details });
            setWsSession(null);
        };

        connection.open();
        getStatus();

    }, []);

    React.useEffect(() => {
        if (pollDocker) {
            const interval = setInterval(() => {
                getStatus().then((result) => {
                    setPollDocker(false);
                    clearInterval(interval);
                });
            }, 1000 * 2);
        }
    }, [pollDocker]);

    const getStatus = () => {
        return new Promise((resolve, reject) => {
            console.log("Polling status from container");
            axios.get(`${dcloudmonitorAPI}/status`).then((res) => {
                if (res && res.data) {
                    console.log(res.data);
                    setCurrentConfig(res.data);
                    return resolve(res.data.receivedconfig === true);
                }
            });
        });
    };

    const saveConfig = (config) => {
        // debugger;
        if (wsSession) {
            // var dataUri = "data:text/plain;base64," + btoa(JSON.stringify(values));
            var dataUri = "data:text/plain;base64," + btoa(JSON.stringify(config));
            debugger;
            const fileTx =
            {
                dataUri: dataUri,
                filename: "reload",
                id: packageName,
                toPath: "/data/acloud/config/registration.json"
            };

            setSavingConfig(true);

            wsSession && wsSession.call("copyFileTo.dappmanager.dnp.dappnode.eth", [], fileTx).then(res => {
                setSavingConfig(false);
                setPollDocker(true);
            });
        }
    };

    const processConfig = values => {
        return new Promise((resolve, reject) => {
            const config = packagewhitelist.reduce((accum, item) => {
                if (values[item.key]) {
                    accum.push({
                        hostname: item.hostname,
                        key: item.key,
                        ports: item.ports
                    });
                }
                return accum;
            }, []);

            // send config to container
            saveConfig(config);
            resolve();
        });

    }

    // Checkbox input
    const Checkbox = ({
        field: { name, value, onChange, onBlur },
        form: { errors, touched, setFieldValue },
        id,
        label,
        className,
        ...props
    }) => {
        return (
            <div>
                <input
                    name={name}
                    id={id}
                    type="checkbox"
                    value={value}
                    checked={value}
                    onChange={onChange}
                    onBlur={onBlur}
                    className={classNames("radio-button", className)}
                />
                <label htmlFor={id}>{label}</label>
                {/* {touched[name] && <InputFeedback error={errors[name]} />} */}
            </div>
        );
    };


    if (currentConfig) {
        console.log("I have a config");
        return (
            <section className="is-medium has-text-white">
                <div className="">
                    <div className="container">
                        <div className="columns is-mobile">
                            <div className="column is-8-desktop is-10">
                                <h1 className="title is-1 has-text-white">AVADO D-Cloud</h1>
                                {/* <div className="media">
                                    <div className="media-left">
                                        <figure className="image is-48x48">
                                        </figure>
                                    </div>

                                </div> */}


                                <div className="setting">
                                    <h3 className="title is-3 has-text-white">Network status</h3>
                                    {currentConfig.networks.map((network, i) => {
                                        return (
                                            <section className="container" key={i}>
                                                <h4 className="title is-4 has-text-white">Network {network.name || network.nwid}</h4>
                                                <div>Status: <b>{network.status}</b></div>
                                                <div>IP addresses <b>{network.assignedAddresses.reduce((accum, ip, i, ips) => {
                                                    accum += ip.split("/")[0] + (ips.length === i + 1 ? "" : ",");
                                                    return accum;
                                                }, "")}</b></div>
                                                <br/>
                                            </section>
                                        )
                                    })}
                                    {currentConfig.registration && currentConfig.registration.config && (
                                        <>
                                            <h3 className="is-size-5">Your shared services</h3>
                                            {packagewhitelist.map((service) => {
                                                const active = currentConfig.registration.config.find((configItem) => {
                                                    return configItem.key === service.key
                                                })
                                                return (
                                                    <div>{service.name}: {active ? "Y" : "N"}</div>
                                                );
                                            })}
                                        </>
                                    )}

                                    <div>My ID : <b>{currentConfig.address}</b></div>

                                    <pre>{currentConfig.haproxyconfig}</pre>
                                    <a onClick={() => { setCurrentConfig(null); }} className="button is-medium is-success">Edit settings</a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

        )
    } else {
        console.log("Dont have a config");
    }


    return (<>
        {/* <QrReader
            delay={300}
            onError={handleError}
            onScan={handleScan}
            style={{ width: '100%' }}
        /> */}
        {/* <button disabled={savingConfig} onClick={saveConfig}>Save config</button> */}


        {packages && (
            <Formik
                initialValues={
                    {
                        agreetandc: true,
                        rewardpubkey: "0xA6f19ccCDD5f90864B9DFd5d5B9e316b1F00C550",
                        ...packages.reduce((accum, item) => {
                            accum[item.key] = true;
                            return accum;
                        }, {})
                    }
                }
                onSubmit={(values, { setSubmitting }) => {
                    processConfig(values).then(() => {
                        setSubmitting(false);
                    });
                }}
                validate={(values) => {

                    console.log("values", values);

                    let errors = {};
                    if (values.agreetandc !== true) {
                        errors["agreetandc"] = "You must agree to the the terms and conditions";
                    }
                    // debugger;
                    if (!values.rewardpubkey) {
                        errors["rewardpubkey"] = "This setting is required";
                    } else {
                        const regex = RegExp('^0x[a-fA-F0-9]{40}$');
                        if (!regex.test(values.rewardpubkey)) {
                            errors["rewardpubkey"] = "This pubkey is invalid";
                        }
                    }
                    return errors;
                }}

            >
                {props => {
                    const {
                        values,
                        touched,
                        errors,
                        dirty,
                        isSubmitting,
                        handleChange,
                        handleBlur,
                        handleSubmit,
                        handleReset,
                        submitForm
                    } = props;
                    return (
                        <>
                            <form onSubmit={handleSubmit}>
                                <section className="is-medium has-text-white">
                                    <div className="">
                                        <div className="container">
                                            <div className="columns is-mobile">
                                                <div className="column is-8-desktop is-10">
                                                    <h1 className="title is-1 is-spaced has-text-white">AVADO D-Cloud</h1>
                                                    <div className="media">
                                                        <div className="media-left">
                                                            <figure className="image is-48x48">
                                                                {/* <img alt="logo" className=" has-background-black" src={logo} /> */}
                                                            </figure>
                                                        </div>
                                                        <div className="media-content">
                                                            <p className="">Share your resources and earn crypto. Together we are powering the web3 with IPFS and Ethereum endpoints</p>
                                                            <p><span className="title is-6"><a href="https://ava.do/">https://ava.do/</a></span></p>

                                                        </div>
                                                    </div>


                                                    <div className="setting">
                                                        <h3 className="is-size-5">Select the packages you want to share in the AVADO D-Cloud</h3>
                                                    </div>

                                                    {packages && (
                                                        <>
                                                            {Object.keys(packages).map((key, i) => {
                                                                return (

                                                                    <div key={i} className="setting">
                                                                        <h3 className="is-size-5">{packages[key].name}</h3>
                                                                        {/* <nav className="level switch_w_options"> */}
                                                                        <div className="level-left">
                                                                            {/* <div className="level-item">
                                                                            <p>No</p>
                                                                        </div> */}
                                                                            {/* <div className="level-item"> */}
                                                                            <div className="field">



                                                                                <Field
                                                                                    component={Checkbox}
                                                                                    name={packages[key].key}
                                                                                    id={packages[key].key}
                                                                                    // label={packages[key].name}
                                                                                    className="switch is-rounded is-link"
                                                                                />
                                                                            </div>
                                                                            <p>{packages[key].description}</p>
                                                                        </div>
                                                                        {/* </div> */}
                                                                        {/* </nav> */}



                                                                    </div>
                                                                );
                                                            })
                                                            }

                                                        </>
                                                    )}


                                                    <div className="setting">
                                                        <h3 className="is-size-5">To which Ethereum address should ava.do send your rewards</h3>
                                                        <div className="field">
                                                            <p className="control">

                                                                <input
                                                                    id="rewardpubkey"
                                                                    placeholder="Your Ethereum address"
                                                                    type="text"
                                                                    value={values.rewardpubkey}
                                                                    onChange={handleChange}
                                                                    onBlur={handleBlur}
                                                                    className={
                                                                        errors.rewardpubkey && touched.rewardpubkey
                                                                            ? "input is-danger"
                                                                            : "input"
                                                                    }
                                                                />

                                                                {/* <input className="input" type="text" placeholder="Your Ethereum address" /> */}
                                                            </p>

                                                            {errors.rewardpubkey && touched.rewardpubkey && (
                                                                <p className="help is-danger">{errors.rewardpubkey}</p>
                                                            )}


                                                        </div>
                                                    </div>


                                                    <div className="setting">
                                                        <h3 className="is-size-5">Do you agree with the <a href="https://dcloud.ava.do/terms-conditions/">Terms and Conditions of the AVADO D-Cloud</a></h3>
                                                        <nav className="level switch_w_options">
                                                            <div className="level-left">

                                                                <div className="level-item">
                                                                    <div className="field">

                                                                        <Field
                                                                            component={Checkbox}
                                                                            name="agreetandc"
                                                                            id="agreetandc"
                                                                            label={values.agreetandc ? "Yes" : "No"}
                                                                            className="switch is-rounded is-link"
                                                                        />

                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </nav>

                                                        {errors.agreetandc && touched.agreetandc && (
                                                            <p className="help is-danger">{errors.agreetandc}</p>
                                                        )}

                                                    </div>


                                                    <div className="field is-grouped buttons">

                                                        <p className="control">
                                                            <a disabled={isSubmitting} onClick={() => { submitForm(); }} className="button is-medium is-success">Save and start package</a>
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            </form>

                        </>

                    );
                }}
            </Formik>
        )}
    </>);


};

export default Comp;