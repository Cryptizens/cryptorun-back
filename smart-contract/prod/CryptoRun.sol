pragma solidity 0.4.21;

// Import the Oraclize contract code so we can inherit from it
import "github.com/oraclize/ethereum-api/oraclizeAPI.sol";

contract CryptoRun is usingOraclize {
  /*
      VARIABLES - to describe the state of the contract
   */
  // The address of the contract owner (Thomas), set when the contract is deployed
  address public ownerAddress = msg.sender;
  // The address of BeCode, the non-profit beneficiary that will receive the funds.
  // Setup at contract construction.
  address public beCodeAddress;
  // The status of the challenge, initialized at deployment to 'ongoing'.
  // Other statuses are 'accomplished' and 'failed'
  string public challengeStatus = 'ongoing';
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
  // a mapping cannot be iterated on for additions or other operations (we
  // could revert to a more complicated scheme with arrays, but we stick to
  // our simple single variable).
  uint public totalDonation = 0;
  // Keep track of all individual donations, so that donors can withdraw their
  // funds if the challenge fails
  mapping (address => uint) public donorsDonations;
  // Pausable behavior state
  bool public paused = false;

  /*
      EVENTS - for broadcasting a set of logs that we can listen to
  */
  // The contract has been deployed, and the challenge can start
  event LogChallengeStarted(address deployerAddress);
  // A new donor has contributed by sending funds
  event LogNewDonation(address donorAddress, uint donationAmount, uint totalDonation);
  // The challenge status has been refreshed
  event LogChallengeStatusRefreshed(string latestStatus);
  // The challenge is still ongoing
  event LogChallengeOngoing();
  // The challenge has been accomplished
  event LogChallengeAccomplished();
  // The challenge is over (after all donations have been withdrawn)
  event LogChallengeOver();
  // The challenge has failed
  event LogChallengeFailed();
  // The funds are available for BeCode to withdraw them (will only be broadcast
  // if the challenge is successful)
  event LogDonationAvailableForBeCodeWithdrawal(uint totalDonation);
  // BeCode has withdrawn the funds
  event LogDonationWithdrawnByBeCode(address beCodeAddress, uint totalDonation);
  // The funds are available for the donors to withdraw (will only be broadcast
  // if the challenge has failed)
  event LogDonationsAvailableForDonorsWithdrawal(uint totalDonation);
  // One of the donors has withdrawn their funds
  event LogDonationWithdrawnByDonor(address donorAddress, uint withdrawnAmount);
  // The last donor withdrew their funds
  event LogLastDonationWithdrawnByDonor(address donorAddress, uint withdrawnAmount);
  // Pausable behavior
  event LogPause();
  event LogUnpause();
  // Oraclize technical event
  event LogNewOraclizeQuery(string description);
  event LogNewOraclizeCallback(bytes32 _queryId);

  /*
      FUNCTION MODIFIERS - to set specific permissions for contract functions
  */
  // For functions that can only be executed either the owner or by BeCode
  modifier onlyOrganizers {
      require((msg.sender == ownerAddress) || (msg.sender == beCodeAddress));
      _;
  }
  // For functions that can only be executed by the Oracle (the address method
  // in the assertion is inherited from the usingOraclize parent contract)
  modifier onlyOracle {
      require(msg.sender == oraclize_cbAddress());
      _;
  }
  // For functions that can only be executed when the challenge is ongoing
  // Note that pure string comparison is not yet supported in Solidity and
  // one has to hash them first then compare their hashes
  modifier whenOngoing {
      require(keccak256(challengeStatus) == keccak256('ongoing'));
      _;
  }
  // For functions that can only be executed when the challenge is accomplished
  modifier whenAccomplished {
      require(keccak256(challengeStatus) == keccak256('accomplished'));
      _;
  }
  // For functions that can only be executed when the challenge is failed
  modifier whenFailed {
      require(keccak256(challengeStatus) == keccak256('failed'));
      _;
  }
  // Pausable behavior - we implement only the not paused modifier
  modifier whenNotPaused() {
    require(!paused);
    _;
  }

  /*
      FUNCTIONS - to implement the behavior of the contract
  */
  // The constructor functions, called when the contract is deployed
  function CryptoRun(address _beCodeAddress) public {
    beCodeAddress = _beCodeAddress;
    emit LogChallengeStarted(msg.sender);
  }

  // The fallback function called anytime someone sends value to the contract
  // This is the 'donate()' function. But we cannot call it donate() because
  // we need a nameless function to be able to send Ether directly from any
  // wallet without having to know about the contract interface.
  function () public payable whenOngoing whenNotPaused {
    require(msg.value > 0);
    // Increase the individual donor balance
    donorsDonations[msg.sender] += msg.value;
    // Increase the total funds donated
    totalDonation += msg.value;
    // Log the donation, along with the new total value of funds donated
    emit LogNewDonation(msg.sender, msg.value, totalDonation);
  }

  // The querying function that will trigger the Oracle to check whether the
  // challenge has been accomplished
  function refreshChallengeStatus() public onlyOrganizers whenOngoing {
    // Call to the Oraclize API
    if (oraclize_getPrice("URL") > address(this).balance) {
        emit LogNewOraclizeQuery("Oraclize query NOT sent, balance too low");
    } else {
        emit LogNewOraclizeQuery("Oraclize query sent, standing by...");
        // Production endpoint
        oraclize_query("URL", "json(https://pgy2ax76f9.execute-api.eu-central-1.amazonaws.com/prod/CryptoRun).challenge_status");
    }
  }

  // The callback function that will be invoked by the Oracle after it has
  // fetched the latest challenge status
  function __callback(bytes32 _queryId, string _result) public onlyOracle {
    // Assert whether success or not, and update contract state accordingly
    string memory latestStatus = _result;

    emit LogNewOraclizeCallback(_queryId);
    emit LogChallengeStatusRefreshed(latestStatus);

    if (keccak256(latestStatus) == keccak256('ongoing')) {
      challengeStatus = 'ongoing';
      emit LogChallengeOngoing();
    } else if (keccak256(latestStatus) == keccak256('accomplished')) {
      challengeStatus = 'accomplished';
      emit LogChallengeAccomplished();
      emit LogDonationAvailableForBeCodeWithdrawal(totalDonation);
    } else if (keccak256(latestStatus) == keccak256('failed')) {
      challengeStatus = 'failed';
      emit LogChallengeFailed();
    } else {
      revert();
    }
  }

  // The BeCode funds withdrawal function - note that we use a withdrawal pattern
  // here (the transfer must be triggered by the funds claimer, and will not
  // be triggered automatically by the contract), as it is known to be much
  // safer (cf. Solidity documentation)
  function withDrawAllDonations() public onlyOrganizers whenAccomplished {
    // Broadcast withdrawal and closing events
    emit LogDonationWithdrawnByBeCode(msg.sender, address(this).balance);
    emit LogChallengeOver();
    // Transfer the remaning contract balance to BeCode
    beCodeAddress.transfer(address(this).balance);
  }

  // The individual donors withdrawal functions (so that they can withdraw
  // their value if the challenge is a failure)
  function withdrawDonorDonation() public whenFailed {
    // Retrieve the amount already contributed
    uint donation = donorsDonations[msg.sender];
    // Set this amount to zero
    donorsDonations[msg.sender] = 0;
    // Transfer the funds to the individual donor. Note that the very last donor
    // to withdraw her funds will meet a contract balance that is lower than
    // the funds she will have contributed. This is because the balance has
    // been slightly depleted by the calls to the Oracle that do consume value.
    // To ensure that the donor can still get this remaining balance, we use
    // a little conditional flow here. Otherwise we would end up trying to
    // transfer an amount greater than the balance and it would trigger an
    // error, thereby actually locking the funds on the contract
    uint remainingBalance = address(this).balance;
    if (remainingBalance > donation) {
      // Broadcast the withdrawal event
      emit LogDonationWithdrawnByDonor(msg.sender, donation);
      msg.sender.transfer(donation);
    } else {
      // Broadcast the withdrawal event
      emit LogLastDonationWithdrawnByDonor(msg.sender, remainingBalance);
      msg.sender.transfer(remainingBalance);
    }
  }

  // Get the current donation for a given donor address
  function donorDonations(address _donorAddress) public constant returns(uint) {
    return donorsDonations[_donorAddress];
  }

  // Pause the donations (fallback payable function)
  function pause() onlyOrganizers whenNotPaused public {
    paused = true;
    emit LogPause();
  }

  // Unpause the donations (fallback payable function)
  function unpause() onlyOrganizers public {
    paused = false;
    emit LogUnpause();
  }
}
