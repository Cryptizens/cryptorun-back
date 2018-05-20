# Cryptorun Back

[UPDATE: the challenge is over! 65KM have been run, and 1.85 ETH have been collected :) Thanks to all!]

This is the back-end engine of the [Cryptorun challenge](https://cryptorun.brussels). The goal of this challenge is for Thomas Vanderstraeten to run 60km around Brussels to raise funds and awareness for BeCode.

The catch: funds will be collected in crypto-currency using ETH, and the GPS of Thomas will be connected to the Blockchain!

You can find detailed explanation of the code behind this challenge on this [general blog article](https://medium.com/@vanderstraeten.thomas/a-crypto-fundraising-for-a-charity-on-the-ethereum-net-with-a-strava-gps-oracle-8a24167c1dad). Please also consult this [blog article dedicated to testing](https://medium.com/@vanderstraeten.thomas/testing-the-cryptorun-smart-contract-a-tale-of-obsessive-perfection-84ded25f1636) of the contract.

Special thanks to [Hannes](https://github.com/jebuske) for his kind review and suggestions!

## Architecture

### Overview
![alt text](https://s3.eu-central-1.amazonaws.com/cryptorun.be/cryptorun-architecture.png "Back-end architecture")

### Smart contract
The smart contract lives at address 0x7ad38438b15338f6d1846961903055ada6fff054, it can be consulted [here on Etherscan](https://etherscan.io/address/0x7ad38438b15338f6d1846961903055ada6fff054). NOTE THAT IT IS NOW CLOSED TO ANY DONATIONS!

### Oracle (Strava connection)
The Oracle in charge of connecting with Strava runs on AWS Lambda with a Python 2.7 runtime.

### Test Oracle
A exceedingly simple dummy Oracle for the Truffle test suite. This Lambda has the same interface as the real Oracle, but the status that it returns can easily be switched as it is read from an environment variable. We use the aws-cli to directly update this environment variable during the tests, to fake the evolution of the challenge status.

## Testing the smart contract

We use Truffle to perform all tests. Once you're done with the below setup, just run `truffle test test/cryptoRun.js` and enjoy the show.

### Importing the Oraclize contract

Note that since Truffle cannot read the Oraclize.sol file directly from GitHub, we have to import this contract locally and source it accordingly in the CryptoRun contract import statement (we use the version available [here](https://github.com/oraclize/ethereum-api/blob/master/oraclizeAPI_0.4.sol)). It is important that the Oraclize contract is named `usingOraclize.sol` so that Truffle knows it's this one that must be imported.

### Launching a local test Blockchain

Make sure you have `ganache-cli` installed. Then run in a daemon window
```
ganache-cli --defaultBalanceEther 1000000 --mnemonic "test blockchain"
```
Note that the mnemonic option will ensure that it's always the same addresses that will be generated, which is require so we don't have to constantly update the OAR in the Ethereum Bridge setup (see further).

### Setting up the Ethereum Bridge
After ganache has been started, make sure you have Ethereum Bridge installed. For this, clone locally the [repo available here](https://github.com/oraclize/ethereum-bridge), then run `npm install`. You can then run the following command in a daemon window
```
node bridge -H localhost:8545 -a 9
```
Wait for the bridge to load (long and verbose). After it's done, it should instruct you to put the following line in the Oraclized smart contract constructor:
```
OAR = OraclizeAddrResolverI(0x6f485C8BF6fc43eA212E93BBF8ce046C7f1cb475);
```
Note that the actual address might vary. Sometimes there might be issue with the Bridge warning that it has already see specific Tx IDs - this is due to incompatibilites with latest solc versions. In that case just delete everything within the ethereum-bridge/database/tingodb folder.

### Setting up AWS
Make sure you have the correct access rights to modify the test Lambda for the Oracle - this will be needed for the forced refreshed during the tests.

## Deployment checklist

Before deploying, do make sure to have removed the following lines from the contract used for testing:

### Import statement
The below line
```
import "./usingOraclize.sol";
```
must be replaced by
```
import "github.com/oraclize/ethereum-api/oraclizeAPI.sol";
```

### OAR in the constructor
The below line should be completely removed from the contract constructor function
```
OAR = OraclizeAddrResolverI(0x6f485C8BF6fc43eA212E93BBF8ce046C7f1cb475);
```

### Oraclize endpoint
The below line
```
oraclize_query("URL", "json(https://pgy2ax76f9.execute-api.eu-central-1.amazonaws.com/test/CryptoRunTest).challenge_status");
```
must be replaced by
```
oraclize_query("URL", "json(https://pgy2ax76f9.execute-api.eu-central-1.amazonaws.com/prod/CryptoRun).challenge_status");
```

### BeCode address
The address of BeCode must be specified as a constructor parameter when the contract is first deployed.
