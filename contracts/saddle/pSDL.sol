// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "../pTokens/pToken.sol";

contract pSDL is pToken {
    constructor() public pToken("Loopfi SDL", "pSDL") {}
}
