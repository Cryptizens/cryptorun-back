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

# Testing the Cryptorun smart contract
A tale of trust, catastrophes, and attack surface

## Some context to start with

### Recap from previous episode

You've probably read before about the whole Cryptorun challenge. This article is dedicated to the touchy question of testing the smart contract powering the challenge. Be ready to be face Blockchain's unique software engineering challenges when it comes to security and testing!

### Why should one test smart contracts?
One should always ensure good test coverage for any software. You brush your teeth every morning. Elementary hygiene, right? Same for testing - testing is just part of the essential stuff you need to perform so that your software stays fit. Now, when it comes to Blockchain development, additional challenges arise that every crypto developer must be acutely aware of:
- You're dealing with actual value flows (ETH for example), just like a bank dealing with fiat currency. This sets high exigences for your code if you want users to trust you and send any value to your contract
- Blockchain is immutable (#1), which means that it'll be close to impossible to patch buggy contracts once they're deployed. Even when a bug is caught, you can end up in situations where you just can't prevent users from continuing to use your contract, leading to ever-increasing numbers of frustrated folks
- Blockchain is immutable (#2), which means that if a buggy transaction arises you won't be able to revert it. Value might get lost or blocked irreversibly, or you might send ETH to a wrong address with no opportunity to retrieve your values
- Blockchain technology is still very young and poorly documented (Ethereum Smart Contracts where first released around 2014). As a consequence, no central knowledge base exists yet for developers to rely on as a checklist for safe development (there's no such thing as the OWASP Top 10 for web apps, for example). So-called coding anti-patterns are not yet deeply rooted in developers brains when it comes to Blockchain development.

(quote)
"In the crypto world, no such security rules currently exist, and it is left to users to conduct their own due diligence when using a DApp"

Reading this, you might be left wondering why on Earth people from the crypto community are actually using any smart contracts / DApps at all. So many risks out there, with such a young technology! In the fiat currency world, software actors dealing with money are subject to stringent requirements and very close scrutiny from auditors so that the risk of bugs is limited. In the crypto world, no such security rules currently exist, and it is left to users to conduct their own due diligence when using a DApp. For large projects, security audits are most often performed using a mix of open-source community reviews, bounty programs, and private audits (cf. [OpenZeppelin](#) and [TBD](#)).

## Smart contract analysis for Cryptorun

Pessimism is welcome here, as it will increase overall trust in the challenge. So, what could go wrong here?

### Setting the scene: stakeholders
Let's first define the different stakeholders interacting with the smart contract:
- BeCode: the non-profit that will be the ultimate beneficiary of the donations
- Thomas: the coder and deployer of the contract, who will also run the challenge
- Donors: the friendly folks that will accept to contribute a few Ethers for BeCode
- Hacker: an hypothetical person with malicious intents
- Oracle: the bridge from the smart contract to Thomas' GPS


### Setting the scene: smart contract lifecycle
Let's first chart the lifecycle of the smart contract along its states

TODO: picture of the smart contract centrally, with the stakeholders all around, with arrows representing available actions (donate, withdraw, call Oracle, set status). The same picture is replicated for each possible status (ongoing, accomplished, failed, closed). The arrows are then plain or red crossed depending on the authorized actions.

### Mapping the bugs and attack surface
Let's envision all the worst scenarios.

- Donations don't work: it is impossible for a donor to send Ether to the contracts when the challenge is ongoing
- Value gets blocked: it is impossible for BeCode to withdraw donations when the challenge is successful
- Value gets blocked: it is impossible for a donor to withdraw her donation when the challenge is failed
- Value gets blocked: when a donor makes several donations in a row, her past donations are overwritten and she loses ability to withdraw them all in the case of challenge failure
- Value gets blocked: it is possible for a donor to send a donation when the challenge is not ongoing
- Value gets stolen: it is possible for a hacker to withdraw the full amount of donation when the challenge is ongoing, successful or failed
- Value gets stolen: it is possible for a hacker to withdraw an individual donor donation when the challenge is ongoing, successful or failed
- Value gets stolen: it is possible for a donor to withdraw her donation when the challenge is not failed
- Value gets stolen: it is possible for a donor to withdraw an amount superior to her donation when the challenge is failed
- Value gets stolen: it is possible for BeCode to withdraw donations when the challenge is ongoing or failed
- Value gets stolen: it is possible for Thomas to withdraw donations when the challenge is ongoing, successful or failed
- Value gets wrongly computed: when a donation is sent, the total balance of donations does not reflect the correct amount donated
- Contract control is lost: it is possible to update the contract status directly, without calling the Oracle (hence rendering the whole challenge irrelevant)
- Contract control is lost: it is possible for someone else than Thomas or BeCode to update the contract status by calling the Oracle (this leads to a depletion of donations because each call to the Oracle costs a bit of gas - hence refreshing the contract should ideally only be done once after challenge success)
- Contract status update goes wrong: a 'success' message from the Oracle does not lead to the right status update of the contract
- Contract status update goes wrong: an 'ongoing' message from the Oracle does not lead to the right status update of the contract
- Contract status update goes wrong: a 'failed' message from the Oracle does not lead to the right status update of the contract

## Doing things elegantly: tests automation

### Setting up a Blockchain test environment with Solidity and Truffle

### The special case of the Oracle: using Ethereum bridge

### The test suite: 20 assertions to success

## Next steps

Did you enjoy reading this? Then certainly it would be nice if you could provide feedback to pressure-test the current contract implementation!
