pragma solidity ^0.4.21;

// Import the Oraclize contract code so we can inherit from it
import "github.com/oraclize/ethereum-api/oraclizeAPI.sol";

contract CryptoRun is usingOraclize {
  /*
      VARIABLES - to describe the state of the contract
   */
  // The address of the contract owner (Thomas), set when the contract is deployed
  address public ownerAddress = msg.sender;
  // The address of BeCode, the non-profit beneficiary that will receive the funds
  // TODO: use the real address - currently a Rinkeby Testnet address belonging
  // to Thomas for development & testing purposes
  address public beCodeAddress = 0x9D55C8FeA20dea8134ade26Ac494C66BABe6D5F4;
  // The status of the challenge, initialized at deployment to 'ongoing'.
  // Other statuses are 'accomplished', 'closed' and 'failed'
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

  /*
      EVENTS - for broadcasting a set of logs that we can listen to
  */
  // The contract has been deployed, and the challenge can start
  event ChallengeStarted(address deployerAddress);
  // A new donor has contributed by sending funds
  event NewDonation(address donorAddress, uint donationAmount, uint totalDonation);
  // The challenge status has been refreshed
  event ChallengeStatusRefreshed(string latestStatus);
  // The challenge has been accomplished
  event ChallengeAccomplished();
  // The challenge has been closed (after all donations have been withdrawn)
  event ChallengeClosed();
  // The challenge has failed
  event ChallengeFailed();
  // The funds are available for BeCode to withdraw them (will only be broadcast
  // if the challenge is successful)
  event DonationAvailableForBeCodeWithdrawal(uint totalDonation);
  // BeCode has withdrawn the funds
  event DonationWithdrawnByBeCode(address beCodeAddress, uint totalDonation);
  // The funds are available for the donors to withdraw (will only be broadcast
  // if the challenge has failed)
  event DonationsAvailableForDonorsWithdrawal(uint totalDonation);
  // One of the donors has withdrawn their funds
  event DonationWithdrawnByDonor(address donorAddress, uint donorDonation);
  // Oraclize technical event
  event NewOraclizeQuery(string description);
  event NewOraclizeCallback(bytes32 _queryId);

  /*
      FUNCTION MODIFIERS - to set specific permissions for contract functions
  */
  // For functions that can only by executed by the owner of the contract, who
  // will be the person that deploys it (Thomas from Cryptizens.io)
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
  function CryptoRun() public {
    emit ChallengeStarted(msg.sender);
  }

  // The fallback function called anytime someone sends value to the contract
  // This is the 'donate()' function. But we cannot call it donate() because
  // we need a nameless function to be able to send Ether directly from any
  // wallet without having to know about the contract interface.
  function () public payable onlyWhenOngoing {
    // Add the individual donor balance
    uint currentDonorDonation = donorsDonations[msg.sender];
    donorsDonations[msg.sender] = currentDonorDonation + msg.value;
    // Increase the total funds donated
    uint currentTotalDonation = totalDonation;
    totalDonation = currentTotalDonation + msg.value;
    // Log the donation, along with the new total value of funds donated
    emit NewDonation(msg.sender, msg.value, totalDonation);
  }

  // The querying function that will trigger the Oracle to check whether the
  // challenge has been accomplished
  function refreshChallengeStatus() public onlyByOrganizers onlyWhenOngoing {
    // Add modifier on time (cannot be called before xxx)
    // Call to the Oraclize API
    if (oraclize_getPrice("URL") > address(this).balance) {
        emit NewOraclizeQuery("Oraclize query NOT sent, balance too low");
    } else {
        emit NewOraclizeQuery("Oraclize query sent, standing by...");
        oraclize_query("URL", "json(https://pgy2ax76f9.execute-api.eu-central-1.amazonaws.com/prod/CryptoRun).challenge_status");
    }
  }

  // The callback function that will be invoked by the Oracle after it has
  // fetched the latest challenge status
  function __callback(bytes32 _queryId, string _result) public onlyByOracle {
    // Assert whether success or not, and update contract state accordingly
    string memory latestStatus = _result;

    emit NewOraclizeCallback(_queryId);
    emit ChallengeStatusRefreshed(latestStatus);

    if (keccak256(latestStatus) == keccak256('ongoing')) {
      challengeStatus = 'ongoing';
    } else if (keccak256(latestStatus) == keccak256('accomplished')) {
      challengeStatus = 'accomplished';
      emit ChallengeAccomplished();
      emit DonationAvailableForBeCodeWithdrawal(totalDonation);
    } else if (keccak256(latestStatus) == keccak256('failed')) {
      challengeStatus = 'failed';
      emit ChallengeFailed();
    } else {
      revert();
    }
  }

  // The BeCode funds withdrawal function - note that we use a withdrawal pattern
  // here (the transfer must be triggered by the funds claimer, and will not
  // be triggered automatically by the contract), as it is known to be much
  // safer (cf. Solidity documentation)
  function withDrawAllDonations() public onlyByBeCode onlyWhenAccomplished {
    // Close the challenge
    challengeStatus = 'closed';
    // Broadcast the closing and withdrawal events
    emit DonationWithdrawnByBeCode(msg.sender, address(this).balance);
    emit ChallengeClosed();
    // Transfer the remaning contract balance to BeCode
    msg.sender.transfer(address(this).balance);
  }

  // The individual donors withdrawal functions (so that they can withdraw
  // their value if the challenge is a failure)
  function withdrawDonorDonation() public onlyWhenFailed {
    // Retrieve the amount already contributed
    uint donation = donorsDonations[msg.sender];
    // Set this amount to zero
    donorsDonations[msg.sender] = 0;
    // Broadcast the withdrawal event
    emit DonationWithdrawnByDonor(msg.sender, donation);
    // Transfer the funds to the individual donor. Note that the very last donor
    // to withdraw her funds will meet a contract balance that is lower than
    // the funds she will have contributed. This is because the balance has
    // been slightly depleted by the calls to the Oracle that do consume value.
    // To ensure that the donor can still get this remaining balance, we use
    // a little conditional flow here. Otherwise we would end up trying to
    // transfer an amount greater than the balance and it would trigger an
    // error, thereby actually locking the funds on the contract!
    if (address(this).balance > donation) {
      msg.sender.transfer(donation);
    } else {
      msg.sender.transfer(address(this).balance);
    }
  }
}
