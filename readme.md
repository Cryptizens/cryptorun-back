# Cryptorun Back

This is the back-end engine of the [Cryptorun challenge](https://cryptorun.brussels). The goal of this challenge is for Thomas Vanderstraeten to run 60km around Brussels to raise funds and awareness for BeCode.

The catch: funds will be collected in crypto-currency using ETH, and the GPS of Thomas will be connected to the Blockchain!

You can find detailed explanation of the code behind this challenge on this [general blog article](#). Please also consult this [blog article dedicated to testing](#) of the contract.

## Overall architecture
![alt text](https://s3.eu-central-1.amazonaws.com/cryptorun.be/cryptorun-architecture.png "Back-end architecture")

## Smart contract
The smart contract lives at address xxxx, it can be consulted [here on Etherscan](https://etherscan.io/).

## Oracle (Strava connection)
The Oracle in charge of connecting with Strava runs on AWS Lambda with a Python 2.7 runtime.

# With trust come responsibilities: Testing the Cryptorun smart contract

## Some context to start with

### Recap from previous episode

You've probably read before about the whole [Cryptorun challenge](https://cryptorun.brussels). This article is dedicated to the critical question of testing the smart contract (the piece of code on the Blockchain) powering the challenge. Be ready to face Blockchain's unique software engineering challenges when it comes to security and testing!

### Why should one test smart contracts?
One should always ensure good test coverage for any piece of software. You brush your teeth every morning. Elementary hygiene, right? Same for testing - testing is just part of the essential stuff you need to perform so that your code stays fit. Now, when it comes to Blockchain development, additional challenges arise that every crypto developer must be acutely aware of:
- You're dealing with actual value flows (ETH for example), just like a bank dealing with fiat currency. This sets high exigences for your code if you want users to trust you and send any value to your contract
- Blockchain is immutable (#1), which means that it'll be close to impossible to patch buggy contracts once they're deployed. Even when a bug is caught, you can end up in situations where you just can't prevent users from continuing to use your contract, leading to ever-increasing numbers of frustrated folks
- Blockchain is immutable (#2), which means that if a buggy transaction arises you won't be able to revert it. Value might get lost or blocked irreversibly, or you might send ETH to a wrong address with no opportunity to retrieve your values
- Blockchain technology is still very young and lacks unified documentation (Ethereum Smart Contracts where first released around 2014). As a consequence, no central knowledge base exists yet for developers to rely on as a checklist for safe development (there's no such thing as the OWASP Top 10 for web apps, for example). So-called coding anti-patterns are not yet deeply rooted in developers brains when it comes to Blockchain development.

(quote)
"In the crypto world, no industry-wide security rules currently exist, and it is left to users to conduct their own due diligence when using a DApp"

Reading this, you might be left wondering why on earth people from the crypto community are actually using any smart contracts / DApps at all. So many risks out there, with such a young technology! In the fiat currency world, software actors dealing with money are subject to stringent requirements and very close scrutiny from auditors so that the risk of bugs is limited. In the crypto world, no such security rules currently exist, and it is left to users to conduct their own due diligence when using a DApp. For large projects, security audits are most often performed using a mix of open-source community reviews, bounty programs, and private audits (cf. [OpenZeppelin](#) and [TBD](#)).

## Smart contract analysis for Cryptorun

Let's focus on the specifics of testing our Cryptorun smart contract. Good testing starts with an analysis of what we want our application to do and not to do. Once we've laid out a structure for the analysis, we can start performing individual tests for all the good and bad cases identified. Given the smart contract will be dealing with real value and engage the reputation of BeCode towards several stakeholders, we have the green light to be super paranoiac in the testing!

### Setting the scene: stakeholders
Let's first define the different stakeholders interacting with the smart contract:
- BeCode: the non-profit that will be the ultimate beneficiary of the donations
- Thomas: the coder and deployer of the contract, who will also run the challenge (that's me!)
- Donors: the friendly folks (including you, hopefully) that will accept to contribute a few Ethers for BeCode
- Hacker: an hypothetical person with malicious intents
- Oracle: the bridge from the smart contract to Thomas' GPS

### Setting the scene: smart contract lifecycle
Let's first understand the lifecycle of the smart contract along its states. This type of application is known as a 'State machine': it moves from one state to the next, with specific actions being possible only at certain states. The allowed states are the following:
- Ongoing: the contract is open to all donations, while BeCode and Thomas publicise the challenge.
- Accomplished: the smart contract learned from the Oracle that Thomas successfully ran the challenge. BeCode can thus withdraw all donations.
- Closed: the challenge is over, no more donations are accepted. This is the end state of the smart contract if the challenge is successful.
- Failed: the smart contract learned from the Oracle that Thomas did not manage to run the challenge. Donors can withdraw their donations. This is the end state of the smart contract if the challenge is not successful.

The state transitions are triggered via a call to the Oracle (leading to accomplished or failed state), and ultimately by BeCode to close the challenge after donations have been withdrawn.

We can thus chart the happy path that the challenge should follow, on the below picture.
TODO: chart with happy path

### Mapping the bugs and attack surface
Now that we've mapped the normal lifecycle, we can lay out the below structure to guide our analysis of all the bad scenarios:

TODO: table with what's allowed an not

Let's detail these scenarios one by one:

- Donations don't work: it is impossible for a donor to send Ether to the contracts when the challenge is ongoing
- Value gets blocked: when a donor makes several donations in a row, her past donations are overwritten and she loses ability to withdraw them all in the case of challenge failure
- Value gets wrongly computed: when a donation is sent, the total balance of donations does not reflect the correct amount donated
- Value gets blocked: it is impossible for BeCode to withdraw donations when the challenge is accomplished
- Value gets blocked: it is impossible for a donor to withdraw her donation when the challenge is failed
- Value gets stolen: it is possible for a donor to withdraw an amount superior to her donation when the challenge is failed
- Value gets blocked: it is possible for a donor to send a donation when the challenge is not ongoing
- Value gets stolen: it is possible for a hacker to withdraw the full amount of donation when the challenge is ongoing, accomplished or failed
- Value gets stolen: it is possible for a hacker to withdraw an individual donor donation when the challenge is ongoing, accomplished or failed
- Value gets stolen: it is possible for a donor to withdraw her donation when the challenge is not failed
- Value gets stolen: it is possible for BeCode to withdraw donations when the challenge is ongoing or failed
- Value gets stolen: it is possible for Thomas to withdraw donations when the challenge is ongoing, accomplished or failed
- Contract control is lost: it is possible to update the contract status directly, without calling the Oracle (hence rendering the whole challenge irrelevant)
- Contract control is lost: it is possible for someone else than Thomas or BeCode to update the contract status by calling the Oracle (this leads to a depletion of donations because each call to the Oracle costs a bit of gas - hence refreshing the contract should ideally only be done once after challenge success)
- Contract status update goes wrong: an 'ongoing' message from the Oracle does not lead to the right status update of the contract
- Contract status update goes wrong: an 'accomplished' message from the Oracle does not lead to the right status update of the contract
- Contract status update goes wrong: a 'failed' message from the Oracle does not lead to the right status update of the contract

## Doing things elegantly: tests automation

As you can imagine from the above structuring work, it would be quite tedious to test all these scenarios manually. This would become painfully time-consuming and error-prone, especially so as the smart contract needs to be tested after each code modification to ensure no breaking changes were introduced. Luckily enough, Blockchain development like other coding environments does benefit from a suite of nice testing tool that allow us to automate the testing.

### Setting up a Blockchain test environment with TestRPC and Truffle
In order to be able to test the smart contract without having to spam one of the Ethereum testnets every time we run our test suite, we must first setup a local Blockchain on our local machine. For this, we use a combination of [TestRPC](#) (a Blockchain simulator) and [Truffle](#) (an IDE for DApps).

We use the following command lines to setup the environment and run a test suite:
// TODO: gist with shell commands for testing

### Writing tests in Solidity: contracts asserting other contracts
When it comes to writing the actual test suite, we must conform with the standard way of asserting programs correctness in Solidity (the language used to code the smart contract). To this end, we actually have to use...other smart contracts, that have the sole responsibility of verifying assertions about other contracts. Here's a typical template for a unit test:
// TODO: gist with tester contract

### The special case of the Oracle: using Ethereum bridge
Before we can run any tests, we need to account for the peculiar nature of our smart contract. Indeed, it is not only connected to the Blockchain, but is also in contact with an Oracle. We must reflect this by allowing it to connect to this Oracle for testing purposes.

Luckily enough, the folks at Oracle have been so kind as to provide us with a nice helper tool for this: [Ethereum Bridge](#). Let's install it and run it:
// TODO: gist with Ethereum bridge code

Note that for testing purposes, we will actually use 4 different Oracles, one for each state. This leads to some duplication in the contract code, but it allows for much easier tests management, as otherwise we would have needed to update the Oracle result to the desired status each time we would change the state.

### The test suite: 20 assertions to success
Now that we've laid the foundations, we can status test

## Next steps

Did you enjoy reading this? Then certainly it would be nice if you could provide feedback to pressure-test the current contract implementation!
