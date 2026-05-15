import { web3 } from "@coral-xyz/anchor";

export enum SupportedChain {
    Testnet,
}

export const PROGRAM_ID: web3.PublicKey = new web3.PublicKey(
    "CjVurumkimPq7vubn7zDtgZUoeNzF8ZF3oo8zJzcWykx"
);
