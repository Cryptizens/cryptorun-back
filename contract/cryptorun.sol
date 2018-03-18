prama solidity ^0.4.19

// Import the Oraclize contract code so we can inherit from it
import "github.com/oraclize/ethereum-api/oraclizeAPI.sol";

contract CryptoRun is usingOraclize {
  /*
      VARIABLES - to describe the state of the contract
   */
  // The address of the contract owner (Thomas), set when the contract is deployed
  address public ownerAddress = msg.sender;
  // The address of BeCode, the non-profit beneficiary that will receive the funds
  address public beCodeAddress = '';
  // The status of the challenge, initialized at deployment to 'ongoing'.
  // Other statuses are 'accomplished', 'closed' and 'failed'
  bytes32 public challengeStatus = 'ongoing';
  // Another interesting variable here is the actual amount of funds that are
  // locked on the contract after donation. In normal contracts, this variable
  // is implicitly available under the name 'balance'. However here, since we
  // need to query an external Oracle (the GPS API), the contract needs to pay
  // a small amount of value at each query, and thus it consumes it own balance.
  // This means that at the end of the challenge, the amount donated to BeCode
  // will be a little bit less that the sum of donations. To still be able to
  // keep track of the total amount donated, we record it with a dedicated
  // variable that we will increase gradually at each donation. Note that we
  // could not add the values in the mapping of individual donations, because
  // a mapping cannot be iterated on (we could revert to a more complicated
  // scheme with arrays, but we stick to our simple single variable).
  uint public totalFundsDonated = 0;
  // Keep track of all individual donations, so that donors can withdraw their
  // funds if the challenge fails
  mapping public (address => uint) fundsDonatedByDonor;

  /*
      EVENTS - for broadcasting a set of logs that we can listen to
  */
  // The contract has been deployed, and the challenge can start
  event ChallengeStarted(address deployerAddress);
  // A new donor has contributed by sending funds
  event FundsDonated(address donorAddress, uint donationAmount, uint totalFundsDonated);
  // The challenge status has been refreshed
  event ChallengeStatusRefreshed(bytes32 currentStatus);
  // The challenge has been accomplished
  event ChallengeAccomplished();
  // The challenge has been closed (after all donations have been withdrawn)
  event ChallengeClosed();
  // The challenge has failed
  event ChallengeFailed();
  // The funds are available for BeCode to withdraw them (will only be broadcast
  // if the challenge is successful)
  event FundsAvailableForBeCodeWithdrawal(uint fundsAmount);
  // BeCode has withdrawn the funds
  event FundsWithdrawnByBeCode(address beCodeAddress, uint fundsAmount);
  // The funds are available for the donors to withdraw (will only be broadcast
  // if the challenge has failed)
  event FundsAvailableForDonorsWithdrawal(uint fundsAmount);
  // One of the donors has withdrawn their funds
  event FundsWithdrawnByDonor(address donorAddress, uint fundsAmount);

  /*
      FUNCTION MODIFIERS - to set specific permissions for contract functions
  */
  // For functions that can only by executed by the owner of the contract, who
  // will be the person that deploys it (Thomas)
  modifier onlyByOwner {
      require(msg.sender == ownerAddress);
      _;
  }
  // For functions that can only be executed by BeCode, the non-profit
  // beneficiary of the funds
  modifier onlyByBeCode {
      require(msg.sender == beCodeAddress);
      _;
  }
  // For functions that can only be executed either the owner or by BeCode
  modifier onlyByOrganizers {
      require((msg.sender == ownerAddress) || (msg.sender == beCodeAddress));
      _;
  }
  // For functions that can only be executed by the Oracle (the address method
  // in the assertion is inherited from the usingOraclize parent contract)
  modifier onlyByOracle {
      require (msg.sender == oraclize_cbAddress());
      _;
  }
  // For functions that can only be executed when the challenge is ongoing
  // Note that pure string comparison is not yet supported in Solidity and
  // one has to hash them first then compare their hashes
  modifier onlyWhenOngoing {
      require(keccak256(challengeStatus) == keccak256('ongoing'));
      _;
  }
  // For functions that can only be executed when the challenge is accomplished
  modifier onlyWhenAccomplished {
      require(keccak256(challengeStatus) == keccak256('accomplished'));
      _;
  }
  // For functions that can only be executed when the challenge is failed
  modifier onlyWhenFailed {
      require(keccak256(challengeStatus) == keccak256('failed'));
      _;
  }

  /*
      FUNCTIONS - to implement the behavior of the contract
  */
  // The constructor functions, called when the contract is deployed
  function CryptoRun() {
    ChallengeStarted(msg.sender);
  }

  // The fallback function called anytime someone sends value to the contract
  function donate() payable public onlyWhenOngoing {
    // Add the donation to the individual donor balance (so a donor can donate
    // multiple times if required)
    uint currentDonorDonation = fundsDonatedByDonor(msg.sender);
    fundsDonatedByDonor(msg.sender) = currentDonorDonation + msg.value;
    // Increase the total funds donated
    uint currentTotalFundsDonated = totalFundsDonated;
    totalFundsDonated = currentTotalFundsDonated + msg.value;
    // Log the donation, along with the new total value of funds donated
    FundsDonated(msg.send, msg.value, totalFundsDonated);
  }

  // The querying function that will trigger the Oracle to check whether the
  // challenge has been accomplished
  function refreshChallengeStatus() public onlyByOrganizers onlyWhenOngoing {
    // Add modifier on time (cannot be called before xxx)
    // Call to the Oraclize API
  }

  // The callback function that will be invoked by the Oracle after it has
  // fetched the latest challenge status
  function __callback(bytes32 _queryId, string _result) public onlyByOracle {
    // Assert whether success or not, and update contract state accordingly
  }

  // The BeCode funds withdrawal function - note that we use a withdrawal pattern
  // here (the transfer must be triggered by the funds claimer, and will not
  // be triggered automatically by the contract), as it is known to be much
  // safer (cf. Solidity documentation)
  function withDrawAllFunds() public onlyByBeCode onlyWhenAccomplished {
    // Close the challenge
    challengeStatus = 'closed';
    // Broadcast the closing and withdrawal events
    FundsWithdrawnByBeCode(msg.sender, this.balance);
    ChallengeClosed();
    // Transfer the remaning contract balance to BeCode
    msg.sender.transfer(this.balance);
  }

  // The individual donors withdrawal functions (so that they can withdraw
  // their value if the challenge is a failure)
  function withdrawIndividualFunds() public onlyWhenFailed {
    // Retrieve the amount already contributed
    uint fundsDonated = fundsDonatedByDonor[msg.sender]
    // Set this amount to zero
    fundsDonatedByDonor[msg.sender] = 0;
    // Broadcast the withdrawal event
    FundsWithdrawnByDonor(msg.sender, fundsDonated);
    // Transfer the funds to the individual donor. Note that the very last donor
    // to withdraw her funds will meet a contract balance that is lower than
    // the funds she will have contributed. This is because the balance has
    // been slightly depleted by the calls to the Oracle that do consume value.
    // To ensure that the donor can still get this remaining balance, we use
    // a little conditional flow here. Otherwise we would end up trying to
    // transfer an amount greater than the balance and it would trigger an
    // error, thereby actually locking the funds on the contract!
    if (this.balance => fundsDonated) {
      msg.sender.transfer(fundsDonated);
    } else {
      msg.sender.transfer(this.balance);
    }
  }
}
