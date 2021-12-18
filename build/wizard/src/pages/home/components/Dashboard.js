import React from "react";
import autobahn from "autobahn-browser";
import { Formik, Form, Field, ErrorMessage } from "formik";
import { listPackages } from "../../../util/avado";
import classNames from "classnames";
import axios from "axios";
import spinnerSVG from "../../../assets/spinner.svg";
import config from "../../../config";
import "./Dashboard.css"

const url = "ws://wamp.my.ava.do:8080/ws";
const realm = "dappnode_admin";

const Comp = () => {

    const [wsSession, setWsSession] = React.useState();
    const [showSpinner, setShowSpinner] = React.useState(false);
    const [packages, setPackages] = React.useState();
    const [pollStatus, setPollStatus] = React.useState(false);
    const [currentConfig, setCurrentConfig] = React.useState(undefined);
    const [currentView, setCurrentView] = React.useState("view");
    const [initialFormValues, setInitialFormValues] = React.useState({});

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

                axios.get(`${config.dcloudmonitor.URL}/pool`).then((res) => {
                    if (res && res.data) {
                        const packagewhitelist = res.data;
                        const whiteListedPackages = packagewhitelist.reduce((accum, item, i) => {
                            if (installedpackages.includes(item.packagename)) {
                                accum.push(item);
                            }
                            return accum;
                        }, []);
                        setPackages(whiteListedPackages);
                    }
                });

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
        if (pollStatus) {
            const interval = setInterval(() => {
                getStatus().then((result) => {
                    setPollStatus(false);
                    setShowSpinner(false);
                    clearInterval(interval);
                });
            }, 1000 * 2);
        }
    }, [pollStatus]);

    React.useEffect(() => {
        if (currentConfig && currentConfig.registration && currentConfig.registration.config) {

            const allServices = packages && packages.reduce((accum, item) => {
                accum[item.key] = false;
                return accum;
            }, {})

            const enabledServices = currentConfig.registration.config.sharedservices.reduce((accum, service) => { accum[service.key] = true; return accum; }, {})

            const initialValues =
            {
                // agreetandc: currentConfig.registration.config.agreetandc || false,
                rewardpubkey: currentConfig.registration.config.rewardpubkey || "",
                nftpubkey: currentConfig.registration.config.nftpubkey || "",
                publicname: currentConfig.registration.config.publicname || "",
                ...allServices,
                ...enabledServices
            }

            setInitialFormValues(initialValues);
            setCurrentView("view");
        }
        else {
            if (packages) {
                const initialValues =
                {
                    // agreetandc: false,
                    rewardpubkey: "",
                    nftpubkey: "",
                    ...packages.reduce((accum, item) => {
                        accum[item.key] = true;
                        return accum;
                    }, {})
                }
                setInitialFormValues(initialValues);
                setCurrentView("view");
            }
        }

    }, [currentConfig, packages]);

    const getStatus = () => {
        setShowSpinner(true);
        return new Promise((resolve, reject) => {
            console.log("Polling status from container");
            axios.get(`${config.dcloudmonitor.URL}/status`).then((res) => {
                if (res && res.data) {
                    // console.log(res.data);
                    setCurrentConfig(res.data);
                    setShowSpinner(false);
                    return resolve(res.data.receivedconfig === true);
                }
            });
        });
    };

    const saveConfig = (configJSON) => {
        if (wsSession) {
            // var dataUri = "data:text/plain;base64," + btoa(JSON.stringify(values));
            var dataUri = "data:text/plain;base64," + btoa(JSON.stringify(configJSON));

            const fileTx =
            {
                dataUri: dataUri,
                filename: "reload",
                id: config.packageName,
                toPath: "/data/acloud/config/registration.json"
            };
            setShowSpinner(true);

            wsSession && wsSession.call("copyFileTo.dappmanager.dnp.dappnode.eth", [], fileTx).then(res => {
                setPollStatus(true);
                setCurrentView("view");
            });
        }
    };

    const processConfig = values => {
        return new Promise((resolve, reject) => {

            const sharedservices = packages ? packages.reduce((accum, item) => {
                if (values[item.key]) {
                    accum.push({
                        hostname: item.hostname,
                        key: item.key,
                        ports: item.ports,
                        frontendports: item.frontendports
                    });
                }
                return accum;
            }, []) : null;

            // send config to container
            saveConfig({
                sharedservices: sharedservices,
                rewardpubkey: values.rewardpubkey,
                nftpubkey: values.nftpubkey,
                publicname: values.publicname
            });
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

    const spinner = () => {
        return (

            <div className="column is-8-desktop is-10 is-offset-1  has-text-centered">
                <p className="is-size-5 has-text-weight-bold">Loading</p>
                <div className="spacer"></div>
                <img alt="spinner" src={spinnerSVG} />
            </div>
        )
    };

    if (showSpinner) {
        return (
            <section className="is-medium has-text-white">
                <div className="">
                    <div className="container">
                        <div className="columns is-mobile">
                            {spinner()}
                        </div>
                    </div>
                </div>
            </section>
        )
    }



    if (currentView === "view") {
        if (currentConfig && currentConfig.registration && currentConfig.registration.config && currentConfig.registration.config) {
            return (
                <>
                    <section className="dashboard is-medium has-text-white">
                        <div className="">
                            {/* <div className="container"> */}
                            <div className="columns is-mobile">
                                <div className="column is-8-desktop is-10">
                                    <h1 className="title is-1 has-text-white">AVADO RYO-Cloud</h1>
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
                                                    <div>IP address <b>{network.assignedAddresses.reduce((accum, ip, i, ips) => {
                                                        accum += ip.split("/")[0] + (ips.length === i + 1 ? "" : ",");
                                                        return accum;
                                                    }, "")}</b></div>
                                                    <div>My ID : <b>{currentConfig.address}</b></div>
                                                    <br />
                                                    <div><a className="button is-small is-success" onClick={getStatus}>refresh</a></div>
                                                    <br />
                                                </section>
                                            )
                                        })}
                                        {currentConfig.registration && currentConfig.registration.config && (
                                            <>
                                                {currentConfig.registration.config.publicname && (
                                                    <>
                                                        <h4 className="title is-4 has-text-white">Your node </h4>
                                                        <div>Node public name <b>{currentConfig.registration.config.publicname}</b></div>
                                                    </>
                                                )}
                                                <br />
                                                <h4 className="title is-4 has-text-white">Services you are sharing in the RYO cloud</h4>
                                                <table>
                                                    <tbody>
                                                        {packages ? packages.reduce((accum, service, i) => {
                                                            const active = currentConfig.registration.config.sharedservices.find((configItem) => {
                                                                return configItem.key === service.key
                                                            })

                                                            if (service.key === "ipfs_pinner") {
                                                                return accum;
                                                            }

                                                            if (active) {
debugger
                                                                // fetch status
                                                                const remoteStatus = currentConfig.acloudstatus.find((group) => {

                                                                    return group.servicegroup === service.key ||
                                                                        (group.servicegroup === "eth_rpc_pool" &&
                                                                            ["ethchain_geth", "ethchain_parity", "ethchain_nethermind"].includes(service.key))
                                                                }) || {
                                                                    status: 0, info: {
                                                                        error: "no registration found in RYO cloud"
                                                                    }
                                                                };

                                                                accum.push(
                                                                    <tr key={i}>
                                                                        <td>
                                                                            {service.name} {service.ports && service.ports.length > 0 && (<>on port {service.ports.map((p, i) => { return (<span key={`port_${i}`}>{p}&nbsp;</span>) })}</>)}
                                                                        </td>
                                                                        <td className="has-text-centered">
                                                                            {remoteStatus.status === 2 ? (
                                                                                <span className="is-fullwidth tag is-success">Online</span>
                                                                            ) : (
                                                                                    <>
                                                                                        <span className="is-fullwidth tag is-warning">Error</span>
                                                                                    </>
                                                                                )}
                                                                        </td>
                                                                        <td>{remoteStatus.info && remoteStatus.info.error}</td>

                                                                        <td>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            }
                                                            return accum;
                                                        }, []) : (
                                                                <tr><td>{spinner()}</td></tr>
                                                            )}
                                                    </tbody>
                                                </table>
                                                <br />
                                                <h4 className="title is-4 has-text-white">Rewards</h4>
                                                <div>Rewards paid to <b>{currentConfig.registration.config.rewardpubkey}</b></div>

                                            </>
                                        )}

                                    </div>
                                </div>
                                {/* </div> */}
                            </div>
                        </div>
                    </section>
                    <section className="is-medium has-text-white">
                        <a onClick={() => { setCurrentView("edit"); }} className="button is-medium is-success">Edit settings</a>
                    </section>
                </>
            )
        } else {
            console.log("Dont have a config");
            setCurrentView("edit");
        }
    }

    if (currentView === "edit") {


        return (<>
            {/* <QrReader
            delay={300}
            onError={handleError}
            onScan={handleScan}
            style={{ width: '100%' }}
        /> */}
            {/* <button disabled={showSpinner} onClick={saveConfig}>Save config</button> */}


            {packages && (
                <Formik
                    initialValues={
                        initialFormValues
                    }
                    onSubmit={(values, { setSubmitting }) => {
                        processConfig(values).then(() => {
                            setSubmitting(false);
                        });
                    }}
                    validate={(values) => {

                        // console.log("values", values);

                        let errors = {};
                        // if (values.agreetandc !== true) {
                        //     errors["agreetandc"] = "You must agree to the the terms and conditions";
                        // }

                        if (!values.rewardpubkey) {
                            errors["rewardpubkey"] = "This setting is required";
                        } else {
                            const regex = RegExp('^0x[a-fA-F0-9]{40}$');
                            if (!regex.test(values.rewardpubkey)) {
                                errors["rewardpubkey"] = "This pubkey is invalid";
                            }
                        }

                        // if (!values.nftpubkey) {
                        //     errors["nftpubkey"] = "This setting is required";
                        // } else {
                        //     const regex = RegExp('^0x[a-fA-F0-9]{40}$');
                        //     if (!regex.test(values.nftpubkey)) {
                        //         errors["nftpubkey"] = "This pubkey is invalid";
                        //     }
                        // }

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
                                                        <h1 className="title is-1 is-spaced has-text-white">AVADO RYO-Cloud</h1>
                                                        <div className="media">
                                                            <div className="media-left">
                                                                <p className="">Share your resources and earn crypto. Together we are powering the web3 with IPFS and Ethereum endpoints</p>
                                                                <p><span className="title is-6"><a href="https://ava.do/">https://ava.do/</a></span></p>

                                                            </div>
                                                        </div>


                                                        <div className="setting">
                                                            <h3 className="is-size-5">Select the packages you want to share in the AVADO RYO-Cloud</h3>
                                                        </div>

                                                        {packages && (
                                                            <>

                                                                <table className="table is-fullwidth">
                                                                    <thead>
                                                                        <tr>
                                                                            <td>shared</td>
                                                                            <td>Service Name</td>
                                                                            <td>Description</td>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>


                                                                        {Object.keys(packages).map((key, i) => {
                                                                            return (
                                                                                <tr key={`service_${i}`}>
                                                                                    <td><div className="level-left">
                                                                                        <div className="field">
                                                                                            <Field
                                                                                                component={Checkbox}
                                                                                                name={packages[key].key}
                                                                                                id={packages[key].key}
                                                                                                // label={packages[key].name}
                                                                                                className="switch is-rounded is-link"
                                                                                            />
                                                                                        </div>
                                                                                    </div>
                                                                                    </td>
                                                                                    <td className="is-size-5">{packages[key].name}</td>
                                                                                    <td>{packages[key].description}</td>
                                                                                </tr>
                                                                            );
                                                                        })
                                                                        }
                                                                    </tbody>
                                                                </table>
                                                            </>
                                                        )}


                                                        <div className="setting">
                                                            <h3 className="is-size-5">Name of your node (optional)</h3>
                                                            <p>Note: This will be used to show your node in statistics - so don't use personal identifiable information here</p>
                                                            <div className="field">
                                                                <p className="control">

                                                                    <input
                                                                        id="publicname"
                                                                        placeholder="Name"
                                                                        type="text"
                                                                        value={values.publicname}
                                                                        onChange={handleChange}
                                                                        onBlur={handleBlur}
                                                                        className={
                                                                            errors.publicname && touched.publicname
                                                                                ? "input is-danger"
                                                                                : "input"
                                                                        }
                                                                    />

                                                                    {/* <input className="input" type="text" placeholder="Your Ethereum address" /> */}
                                                                </p>

                                                                {errors.publicname && touched.publicname && (
                                                                    <p className="help is-danger">{errors.publicname}</p>
                                                                )}


                                                            </div>
                                                        </div>


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


                                                        {/* <div className="setting">
                                                            <h3 className="is-size-5">Enter your AVADO NFT address</h3>
                                                            <p>Please provide the public key of the NFT card in your AVADO box to participate in the reward pool. </p>
                                                            <div className="field">
                                                                <p className="control">
                                                                    <input
                                                                        id="nftpubkey"
                                                                        placeholder="Your AVADO NFT address"
                                                                        type="text"
                                                                        value={values.nftpubkey}
                                                                        onChange={handleChange}
                                                                        onBlur={handleBlur}
                                                                        className={
                                                                            errors.nftpubkey && touched.nftpubkey
                                                                                ? "input is-danger"
                                                                                : "input"
                                                                        }
                                                                    />
                                                                </p>
                                                                {errors.nftpubkey && touched.nftpubkey && (
                                                                    <p className="help is-danger">{errors.nftpubkey}</p>
                                                                )}
                                                            </div>
                                                        </div> */}


                                                        {/* <div className="setting">
                                                            <h3 className="is-size-5">Do you agree with the <a href="https://ava.do/ryo-terms-conditions/">Terms and Conditions of the AVADO RYO-Cloud</a></h3>
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

                                                        </div> */}


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
            <div>{process.env.REACT_APP_VERSION}</div>
        </>);
    }

    return null;
};

export default Comp;