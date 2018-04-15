const CryptoRun = artifacts.require('./CryptoRun.sol')

contract('CryptoRun', function ([owner, beCode, donor1, donor2, hacker]) {
  let cryptoRun

  beforeEach('setup contract for each test', async function () {
      cryptoRun = await CryptoRun.new(beCode)
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

  it('is initially deployed with a total donations amount equal to 0', async function () {
      assert.equal(await cryptoRun.totalDonation(), 0)
  })

  it('accepts incoming donations while ONGOING, and does not allow to withdraw them while still ONGOING', async function () {
      const donation = 1e+18
      const cryptoRunAddress = await cryptoRun.address

      assert.equal(await cryptoRun.totalDonation(), 0)
      assert.equal(await cryptoRun.donorDonations(donor1), 0)
      assert.equal(web3.eth.getBalance(cryptoRunAddress).toNumber(), 0)

      await cryptoRun.sendTransaction({ value: donation, from: donor1 })

      assert.equal(await cryptoRun.totalDonation(), donation)
      assert.equal(await cryptoRun.donorDonations(donor1), donation)
      assert.equal(web3.eth.getBalance(cryptoRunAddress).toNumber(), donation)

      try {
          await cryptoRun.withdrawDonorDonation()
          assert.fail()
      } catch (error) {
          assert(error.toString().includes('revert'), error.toString())
      }

      assert.equal(await cryptoRun.totalDonation(), donation)
      assert.equal(await cryptoRun.donorDonations(donor1), donation)
      assert.equal(web3.eth.getBalance(cryptoRunAddress).toNumber(), donation)
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

  it('cannot be refreshed by a Hacker', async function () {
      // To be able to query the Oracle, the contract needs some balance
      await cryptoRun.sendTransaction({ value: 1e+18, from: donor1 })

      try {
          await cryptoRun.refreshChallengeStatus({ from: hacker })
          assert.fail()
      } catch (error) {
          assert(error.toString().includes('revert'), error.toString())
      }
  })

  it('successfully updates to ACCOMPLISHED status when challenge is accomplished', async function() {
    // To be able to query the Oracle, the contract needs some balance
    await cryptoRun.sendTransaction({ value: 1e+18, from: donor1 })

    assert.equal(await cryptoRun.challengeStatus(), 'ongoing')

    await forceOracleStatus('accomplished')

    await cryptoRun.refreshChallengeStatus()
    await waitForOracleCallback()

    assert.equal(await cryptoRun.challengeStatus(), 'accomplished')

    await forceOracleStatus('ongoing')
  })

  it('successfully updates to FAILED status when challenge is failed', async function() {
    // To be able to query the Oracle, the contract needs some balance
    await cryptoRun.sendTransaction({ value: 1e+18, from: donor1 })

    assert.equal(await cryptoRun.challengeStatus(), 'ongoing')

    await forceOracleStatus('failed')

    await cryptoRun.refreshChallengeStatus()
    await waitForOracleCallback()

    assert.equal(await cryptoRun.challengeStatus(), 'failed')

    await forceOracleStatus('ongoing')
  })

  it('correctly executes across its full lifecycle, for the happy path with a successful challenge', async function() {
    const donation1 = 1e+18
    const donation2 = 2e+18
    const totalDonation = donation1 + donation2
    const cryptoRunAddress = await cryptoRun.address
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

    assert.equal(await cryptoRun.challengeStatus(), 'closed')

    await forceOracleStatus('ongoing')
  })

  /*
   * Helper to wait for Oracle callback
  */
  async function waitForOracleCallback() {
    await promisifyLogWatch(cryptoRun.ChallengeStatusRefreshed({ fromBlock: 'latest' }))
  }

  /*
  * Helper method to remotely update the test Oracle endpoint
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
