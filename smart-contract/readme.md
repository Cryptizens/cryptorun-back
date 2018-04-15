## Testing the smart contract

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
Note that the actual address might vary.

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
import "github.com/oraclize/ethereum-api/oraclizeAPI.sol"; */
```

### OAR in the constructor
The below line should be completely removed from the contract constructor function
```
OAR = OraclizeAddrResolverI(0x6f485C8BF6fc43eA212E93BBF8ce046C7f1cb475);
```

### Oraclize endpoint
The below line
```
oraclize_query("URL", "json(https://wqy7ols8ob.execute-api.eu-central-1.amazonaws.com/prod/CryptoRunTest).challenge_status");
```
must be replaced by
```
oraclize_query("URL", "json(https://pgy2ax76f9.execute-api.eu-central-1.amazonaws.com/prod/CryptoRun).challenge_status");
```

### BeCode address
The address of BeCode must be specified as a constructor parameter when the contract is first deployed.
