// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ERC20Mock is ERC20 {
    constructor(string memory _name, string memory _symbol)
        public
        ERC20(_name, _symbol)
    {}

    /**
     * @notice Only for test, so there is no permissions for this function.
     * @dev Mint `amount` token to `account`.
     */
    function mint(address account, uint256 amount) public {
        _mint(account, amount);
    }

    /**
     * @dev Burn `amount` token from `account`.
     */
    function burn(address account, uint256 amount) public {
        _burn(account, amount);
    }
}
