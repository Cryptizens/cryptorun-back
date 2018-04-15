const CryptoRun = artifacts.require('./CryptoRun.sol')

contract('CryptoRun', function ([owner]) {
  let cryptoRun

  beforeEach('setup contract for each test', async function () {
      cryptoRun = await CryptoRun.new()
  })

  it('has an owner equal to its deployer', async function () {
      assert.equal(await cryptoRun.ownerAddress(), owner)
  })

  it('is initially deployed with an ONGOING status', async function () {
      assert.equal(await cryptoRun.challengeStatus(), 'ongoing')
  })

  it('is initially deployed with a total donations amount equal to 0', async function () {
      assert.equal(await cryptoRun.totalDonation(), 0)
  })
})
