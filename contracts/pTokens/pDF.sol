// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./pToken.sol";

contract pDF is pToken {
    constructor() public pToken("Loopfi DF", "pDF") {
    }
}
