export const DAI_CONTRACT = {
  1: {
    address: "0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359",
    abi: [
      {
        constant: true,
        inputs: [{ name: "src", type: "address" }],
        name: "balanceOf",
        outputs: [{ name: "", type: "uint256" }],
        payable: false,
        stateMutability: "view",
        type: "function"
      }
    ]
  }
};
