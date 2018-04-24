const CryptoRun = artifacts.require('./CryptoRun.sol')

contract('CryptoRun', function ([owner, beCode, donor1, donor2, hacker]) {
  let cryptoRun
  let cryptoRunAddress

  beforeEach('setup contract and Oracle for each test', async function () {
      cryptoRun = await CryptoRun.new(beCode)
      cryptoRunAddress = await cryptoRun.address
      await forceOracleStatus('ongoing')
  })

  it('has an owner equal to its deployer', async function () {
      assert.equal(await cryptoRun.ownerAddress(), owner)
  })

  it('correctly sets BeCode address at deployment', async function () {
      assert.equal(await cryptoRun.beCodeAddress(), beCode)
  })

  it('is initially deployed with an ONGOING status', async function () {
      assert.equal(await cryptoRun.challengeStatus(), 'ongoing')
  })

  it('is initially deployed in an unpaused state', async function () {
      assert.equal(await cryptoRun.paused(), false)
  })

  it('is initially deployed with a total donations amount equal to 0', async function () {
      assert.equal(await cryptoRun.totalDonation(), 0)
  })

  it('can be refreshed by its owner', async function () {
      // To be able to query the Oracle, the contract needs some balance
      await cryptoRun.sendTransaction({ value: 1e+18, from: donor1 })

      await cryptoRun.refreshChallengeStatus()
      await waitForOracleCallback()

      assert.equal(await cryptoRun.challengeStatus(), 'ongoing')
  })

  it('can be refreshed by BeCode', async function () {
      // To be able to query the Oracle, the contract needs some balance
      await cryptoRun.sendTransaction({ value: 1e+18, from: donor1 })

      await cryptoRun.refreshChallengeStatus({ from: beCode })
      await waitForOracleCallback()

      assert.equal(await cryptoRun.challengeStatus(), 'ongoing')
  })

  it('cannot be refreshed by a hacker', async function () {
      // To be able to query the Oracle, the contract needs some balance
      await cryptoRun.sendTransaction({ value: 1e+18, from: donor1 })

      try {
          await cryptoRun.refreshChallengeStatus({ from: hacker })
          assert.fail()
      } catch (error) {
          assert(error.toString().includes('revert'), error.toString())
      }
  })

  it('can be paused by its owner', async function () {
      assert.equal(await cryptoRun.paused(), false)
      await cryptoRun.pause()
      assert.equal(await cryptoRun.paused(), true)
  })

  it('can be paused by BeCode', async function () {
      assert.equal(await cryptoRun.paused(), false)
      await cryptoRun.pause({ from: beCode })
      assert.equal(await cryptoRun.paused(), true)
  })

  it('cannot be paused by a hacker', async function () {
      assert.equal(await cryptoRun.paused(), false)

      try {
          await cryptoRun.pause({ from: hacker })
          assert.fail()
      } catch (error) {
          assert(error.toString().includes('revert'), error.toString())
      }

      assert.equal(await cryptoRun.paused(), false)
  })

  it('can be unpaused by its owner', async function () {
      await cryptoRun.pause()
      assert.equal(await cryptoRun.paused(), true)

      await cryptoRun.unpause()
      assert.equal(await cryptoRun.paused(), false)
  })

  it('can be unpaused by BeCode', async function () {
      await cryptoRun.pause({ from: beCode })
      assert.equal(await cryptoRun.paused(), true)

      await cryptoRun.unpause({ from: beCode })
      assert.equal(await cryptoRun.paused(), false)
  })

  it('cannot be unpaused by a hacker', async function () {
      await cryptoRun.pause()
      assert.equal(await cryptoRun.paused(), true)

      try {
          await cryptoRun.pause({ from: hacker })
          assert.fail()
      } catch (error) {
          assert(error.toString().includes('revert'), error.toString())
      }

      assert.equal(await cryptoRun.paused(), true)
  })

  it('cannot be refreshed anymore once ACCOMPLISHED', async function () {
      // To be able to query the Oracle, the contract needs some balance
      await cryptoRun.sendTransaction({ value: 1e+18, from: donor1 })

      await forceOracleStatus('accomplished')
      await cryptoRun.refreshChallengeStatus()
      await waitForOracleCallback()

      try {
          await cryptoRun.refreshChallengeStatus()
          assert.fail()
      } catch (error) {
          assert(error.toString().includes('revert'), error.toString())
      }

      assert.equal(await cryptoRun.challengeStatus(), 'accomplished')
  })

  it('cannot be refreshed anymore once FAILED', async function () {
      // To be able to query the Oracle, the contract needs some balance
      await cryptoRun.sendTransaction({ value: 1e+18, from: donor1 })

      await forceOracleStatus('failed')
      await cryptoRun.refreshChallengeStatus()
      await waitForOracleCallback()

      try {
          await cryptoRun.refreshChallengeStatus()
          assert.fail()
      } catch (error) {
          assert(error.toString().includes('revert'), error.toString())
      }

      assert.equal(await cryptoRun.challengeStatus(), 'failed')
  })

  it('successfully remains in ONGOING status when refreshed if challenge is ongoing', async function() {
      // To be able to query the Oracle, the contract needs some balance
      await cryptoRun.sendTransaction({ value: 1e+18, from: donor1 })

      assert.equal(await cryptoRun.challengeStatus(), 'ongoing')

      await forceOracleStatus('ongoing')

      await cryptoRun.refreshChallengeStatus()
      await waitForOracleCallback()

      assert.equal(await cryptoRun.challengeStatus(), 'ongoing')
  })

  it('successfully updates to ACCOMPLISHED status when refreshed if challenge is accomplished', async function() {
      // To be able to query the Oracle, the contract needs some balance
      await cryptoRun.sendTransaction({ value: 1e+18, from: donor1 })

      assert.equal(await cryptoRun.challengeStatus(), 'ongoing')

      await forceOracleStatus('accomplished')

      await cryptoRun.refreshChallengeStatus()
      await waitForOracleCallback()

      assert.equal(await cryptoRun.challengeStatus(), 'accomplished')
  })

  it('successfully updates to FAILED status when refreshed if challenge is failed', async function() {
      // To be able to query the Oracle, the contract needs some balance
      await cryptoRun.sendTransaction({ value: 1e+18, from: donor1 })

      assert.equal(await cryptoRun.challengeStatus(), 'ongoing')

      await forceOracleStatus('failed')

      await cryptoRun.refreshChallengeStatus()
      await waitForOracleCallback()

      assert.equal(await cryptoRun.challengeStatus(), 'failed')
  })

  it('accepts incoming donations when ONGOING', async function () {
      const donation = 1e+18

      assert.equal(await cryptoRun.totalDonation(), 0)
      assert.equal(await cryptoRun.donorDonations(donor1), 0)
      assert.equal(web3.eth.getBalance(cryptoRunAddress).toNumber(), 0)

      await cryptoRun.sendTransaction({ value: donation, from: donor1 })

      assert.equal(await cryptoRun.totalDonation(), donation)
      assert.equal(await cryptoRun.donorDonations(donor1), donation)
      assert.equal(web3.eth.getBalance(cryptoRunAddress).toNumber(), donation)
  })

  it('does not accept incoming donations when ACCOMPLISHED', async function () {
      const donation = 1e+18
      const donor1BalanceBeforeDonation = web3.eth.getBalance(donor1).toNumber()

      assert.equal(await cryptoRun.totalDonation(), 0)
      assert.equal(await cryptoRun.donorDonations(donor1), 0)
      assert.equal(web3.eth.getBalance(cryptoRunAddress).toNumber(), 0)

      await forceOracleStatus('accomplished')
      await cryptoRun.refreshChallengeStatus()
      await waitForOracleCallback()

      try {
          await cryptoRun.sendTransaction({ value: donation, from: donor1 })
          assert.fail()
      } catch (error) {
          assert(error.toString().includes('revert'), error.toString())
      }

      assert.equal(await cryptoRun.totalDonation(), 0)
      assert.equal(await cryptoRun.donorDonations(donor1), 0)
      assert.equal(web3.eth.getBalance(cryptoRunAddress).toNumber(), 0)
  })

  it('does not accept incoming donations when FAILED', async function () {
      const donation = 1e+18
      const donor1BalanceBeforeDonation = web3.eth.getBalance(donor1).toNumber()

      assert.equal(await cryptoRun.totalDonation(), 0)
      assert.equal(await cryptoRun.donorDonations(donor1), 0)
      assert.equal(web3.eth.getBalance(cryptoRunAddress).toNumber(), 0)

      await forceOracleStatus('failed')
      await cryptoRun.refreshChallengeStatus()
      await waitForOracleCallback()

      try {
          await cryptoRun.sendTransaction({ value: donation, from: donor1 })
          assert.fail()
      } catch (error) {
          assert(error.toString().includes('revert'), error.toString())
      }

      assert.equal(await cryptoRun.totalDonation(), 0)
      assert.equal(await cryptoRun.donorDonations(donor1), 0)
      assert.equal(web3.eth.getBalance(cryptoRunAddress).toNumber(), 0)
  })

  it('does not accept incoming donations when paused', async function () {
      const donation = 1e+18
      const donor1BalanceBeforeDonation = web3.eth.getBalance(donor1).toNumber()

      assert.equal(await cryptoRun.totalDonation(), 0)
      assert.equal(await cryptoRun.donorDonations(donor1), 0)
      assert.equal(web3.eth.getBalance(cryptoRunAddress).toNumber(), 0)

      await cryptoRun.pause()
      assert.equal(await cryptoRun.paused(), true)

      try {
          await cryptoRun.sendTransaction({ value: donation, from: donor1 })
          assert.fail()
      } catch (error) {
          assert(error.toString().includes('revert'), error.toString())
      }

      assert.equal(await cryptoRun.totalDonation(), 0)
      assert.equal(await cryptoRun.donorDonations(donor1), 0)
      assert.equal(web3.eth.getBalance(cryptoRunAddress).toNumber(), 0)
  })

  it('does not allow to withdraw individual donations when ONGOING', async function () {
      const donation = 1e+18

      assert.equal(await cryptoRun.totalDonation(), 0)
      assert.equal(await cryptoRun.donorDonations(donor1), 0)
      assert.equal(web3.eth.getBalance(cryptoRunAddress).toNumber(), 0)

      await cryptoRun.sendTransaction({ value: donation, from: donor1 })

      assert.equal(await cryptoRun.totalDonation(), donation)
      assert.equal(await cryptoRun.donorDonations(donor1), donation)
      assert.equal(web3.eth.getBalance(cryptoRunAddress).toNumber(), donation)

      try {
          await cryptoRun.withdrawDonorDonation({ from: donor1 })
          assert.fail()
      } catch (error) {
          assert(error.toString().includes('revert'), error.toString())
      }

      assert.equal(await cryptoRun.totalDonation(), donation)
      assert.equal(await cryptoRun.donorDonations(donor1), donation)
      assert.equal(web3.eth.getBalance(cryptoRunAddress).toNumber(), donation)
  })

  it('does not allow to withdraw individual donations when ACCOMPLISHED', async function () {
      const donation = 1e+18

      assert.equal(await cryptoRun.totalDonation(), 0)
      assert.equal(await cryptoRun.donorDonations(donor1), 0)
      assert.equal(web3.eth.getBalance(cryptoRunAddress).toNumber(), 0)

      await cryptoRun.sendTransaction({ value: donation, from: donor1 })

      assert.equal(await cryptoRun.totalDonation(), donation)
      assert.equal(await cryptoRun.donorDonations(donor1), donation)
      assert.equal(web3.eth.getBalance(cryptoRunAddress).toNumber(), donation)

      await forceOracleStatus('accomplished')
      await cryptoRun.refreshChallengeStatus()
      await waitForOracleCallback()

      try {
          await cryptoRun.withdrawDonorDonation({ from: donor1 })
          assert.fail()
      } catch (error) {
          assert(error.toString().includes('revert'), error.toString())
      }

      assert.equal(await cryptoRun.totalDonation(), donation)
      assert.equal(await cryptoRun.donorDonations(donor1), donation)
      assert.equal(web3.eth.getBalance(cryptoRunAddress).toNumber(), donation)
  })

  it('does not allow a hacker to withdraw all donations when ACCOMPLISHED', async function () {
      const donation = 1e+18

      assert.equal(await cryptoRun.totalDonation(), 0)
      assert.equal(await cryptoRun.donorDonations(donor1), 0)
      assert.equal(web3.eth.getBalance(cryptoRunAddress).toNumber(), 0)

      await cryptoRun.sendTransaction({ value: donation, from: donor1 })

      assert.equal(await cryptoRun.totalDonation(), donation)
      assert.equal(await cryptoRun.donorDonations(donor1), donation)
      assert.equal(web3.eth.getBalance(cryptoRunAddress).toNumber(), donation)

      await forceOracleStatus('accomplished')
      await cryptoRun.refreshChallengeStatus()
      await waitForOracleCallback()

      try {
          await cryptoRun.withDrawAllDonations({ from: hacker })
          assert.fail()
      } catch (error) {
          assert(error.toString().includes('revert'), error.toString())
      }

      assert.equal(await cryptoRun.totalDonation(), donation)
      assert.equal(await cryptoRun.donorDonations(donor1), donation)
      assert.equal(web3.eth.getBalance(cryptoRunAddress).toNumber(), donation)
  })

  it('does not allow a donor to withdraw all donations when ACCOMPLISHED', async function () {
      const donation = 1e+18

      assert.equal(await cryptoRun.totalDonation(), 0)
      assert.equal(await cryptoRun.donorDonations(donor1), 0)
      assert.equal(web3.eth.getBalance(cryptoRunAddress).toNumber(), 0)

      await cryptoRun.sendTransaction({ value: donation, from: donor1 })

      assert.equal(await cryptoRun.totalDonation(), donation)
      assert.equal(await cryptoRun.donorDonations(donor1), donation)
      assert.equal(web3.eth.getBalance(cryptoRunAddress).toNumber(), donation)

      await forceOracleStatus('accomplished')
      await cryptoRun.refreshChallengeStatus()
      await waitForOracleCallback()

      try {
          await cryptoRun.withDrawAllDonations({ from: donor1 })
          assert.fail()
      } catch (error) {
          assert(error.toString().includes('revert'), error.toString())
      }

      assert.equal(await cryptoRun.totalDonation(), donation)
      assert.equal(await cryptoRun.donorDonations(donor1), donation)
      assert.equal(web3.eth.getBalance(cryptoRunAddress).toNumber(), donation)
  })

  it('does not allow BeCode to withdraw all donations when FAILED', async function () {
      const donation = 1e+18

      assert.equal(await cryptoRun.totalDonation(), 0)
      assert.equal(await cryptoRun.donorDonations(donor1), 0)
      assert.equal(web3.eth.getBalance(cryptoRunAddress).toNumber(), 0)

      await cryptoRun.sendTransaction({ value: donation, from: donor1 })

      assert.equal(await cryptoRun.totalDonation(), donation)
      assert.equal(await cryptoRun.donorDonations(donor1), donation)
      assert.equal(web3.eth.getBalance(cryptoRunAddress).toNumber(), donation)

      await forceOracleStatus('failed')
      await cryptoRun.refreshChallengeStatus()
      await waitForOracleCallback()

      try {
          await cryptoRun.withDrawAllDonations({ from: beCode })
          assert.fail()
      } catch (error) {
          assert(error.toString().includes('revert'), error.toString())
      }

      assert.equal(await cryptoRun.totalDonation(), donation)
      assert.equal(await cryptoRun.donorDonations(donor1), donation)
      assert.equal(web3.eth.getBalance(cryptoRunAddress).toNumber(), donation)
  })

  it('does not allow the owner to withdraw all donations when FAILED', async function () {
      const donation = 1e+18

      assert.equal(await cryptoRun.totalDonation(), 0)
      assert.equal(await cryptoRun.donorDonations(donor1), 0)
      assert.equal(web3.eth.getBalance(cryptoRunAddress).toNumber(), 0)

      await cryptoRun.sendTransaction({ value: donation, from: donor1 })

      assert.equal(await cryptoRun.totalDonation(), donation)
      assert.equal(await cryptoRun.donorDonations(donor1), donation)
      assert.equal(web3.eth.getBalance(cryptoRunAddress).toNumber(), donation)

      await forceOracleStatus('failed')
      await cryptoRun.refreshChallengeStatus()
      await waitForOracleCallback()

      try {
          await cryptoRun.withDrawAllDonations({ from: owner })
          assert.fail()
      } catch (error) {
          assert(error.toString().includes('revert'), error.toString())
      }

      assert.equal(await cryptoRun.totalDonation(), donation)
      assert.equal(await cryptoRun.donorDonations(donor1), donation)
      assert.equal(web3.eth.getBalance(cryptoRunAddress).toNumber(), donation)
  })

  it('correctly executes across its full lifecycle, for a successful challenge scenario', async function() {
      const donation1 = 1e+18
      const donation2 = 2e+18
      const totalDonation = donation1 + donation2
      const beCodeBalanceBeforeWithDrawal = web3.eth.getBalance(beCode).toNumber()

      await cryptoRun.sendTransaction({ value: donation1, from: donor1 })
      await cryptoRun.sendTransaction({ value: donation2, from: donor2 })

      assert.equal(await cryptoRun.challengeStatus(), 'ongoing')
      assert.equal(await cryptoRun.totalDonation(), totalDonation)
      assert.equal(web3.eth.getBalance(cryptoRunAddress).toNumber(), totalDonation)

      await forceOracleStatus('accomplished')
      await cryptoRun.refreshChallengeStatus()
      await waitForOracleCallback()

      assert.equal(await cryptoRun.challengeStatus(), 'accomplished')

      await cryptoRun.withDrawAllDonations()

      assert.equal(web3.eth.getBalance(cryptoRunAddress).toNumber(), 0)
      assert.equal(web3.eth.getBalance(beCode).toNumber(), beCodeBalanceBeforeWithDrawal + totalDonation)

      assert.equal(await cryptoRun.challengeStatus(), 'accomplished')
  })

  it('correctly executes across its full lifecycle, for a failed challenge scenario', async function () {
      const donation1 = 1e+18
      const donation2 = 2e+18
      const totalDonor1Donation = donation1 + donation2

      const donation3 = 1e+17
      const totalDonor2Donation = donation3

      const totalDonorsDonation = totalDonor1Donation + totalDonor2Donation

      const donor1BalanceBeforeDonation = web3.eth.getBalance(donor1).toNumber()
      const donor2BalanceBeforeDonation = web3.eth.getBalance(donor2).toNumber()

      const donationReceipt1 = await cryptoRun.sendTransaction({ value: donation1, from: donor1 })
      const donationReceipt2 = await cryptoRun.sendTransaction({ value: donation2, from: donor1 })
      const donationReceipt3 = await cryptoRun.sendTransaction({ value: donation3, from: donor2 })

      assert.equal(await cryptoRun.donorDonations(donor1), totalDonor1Donation)
      assert.equal(await cryptoRun.donorDonations(donor2), totalDonor2Donation)
      assert.equal(await cryptoRun.totalDonation(), totalDonorsDonation)

      await forceOracleStatus('failed')
      await cryptoRun.refreshChallengeStatus()
      await waitForOracleCallback()

      const withdrawalReceipt1 = await cryptoRun.withdrawDonorDonation({ from: donor1 })
      const withdrawalReceipt2 = await cryptoRun.withdrawDonorDonation({ from: donor2 })

      assert.equal(web3.eth.getBalance(cryptoRunAddress).toNumber(), 0)

      const donationTransactionCost1 = await getTransactionCost(donationReceipt1)
      const donationTransactionCost2 = await getTransactionCost(donationReceipt2)
      const donationTransactionCost3 = await getTransactionCost(donationReceipt3)

      const withdrawalTransactionCost1 = await getTransactionCost(withdrawalReceipt1)
      const withdrawalTransactionCost2 = await getTransactionCost(withdrawalReceipt2)

      assert.equal(web3.eth.getBalance(donor1).toNumber(), donor1BalanceBeforeDonation - donationTransactionCost1 - donationTransactionCost2 - withdrawalTransactionCost1)
      assert.equal(web3.eth.getBalance(donor2).toNumber(), donor2BalanceBeforeDonation - donationTransactionCost3 - withdrawalTransactionCost2)
  })

  /*
   * Helper to get the cost of a transaction - note that we need to gather
   * the necessary input for calculation from 2 different sources...
  */
  async function getTransactionCost(receipt) {
    const gasUsed = receipt.receipt.gasUsed
    const tx = await web3.eth.getTransaction(receipt.tx)
    const gasPrice = tx.gasPrice

    return gasUsed * gasPrice
  }

  /*
   * Helper to wait for Oracle callback
  */
  async function waitForOracleCallback() {
      await promisifyLogWatch(cryptoRun.LogChallengeStatusRefreshed({ fromBlock: 'latest' }))
  }

  /*
  * Helper to remotely update the test Oracle endpoint
  */
  async function forceOracleStatus(status) {
      const util = require('util')
      const exec = util.promisify(require('child_process').exec)

      const awsCliCommand = 'aws lambda update-function-configuration --profile cryptizens-lambdas-deployer --function-name CryptoRunTest --environment Variables={status=' + status + '}'

      const { stdout, stderr } = await exec(awsCliCommand)
  }

  /*
  * @credit https://github.com/AdamJLemmon
  * Helper to wait for log emission. * @param {Object} _event The event to wait for.
  */
  function promisifyLogWatch(_event) {
    return new Promise((resolve, reject) => {
      _event.watch((error, log) => {
        _event.stopWatching();
        if (error !== null)
        reject(error)
        resolve(log)
  }) })}
})
