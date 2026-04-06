import { Program } from "@coral-xyz/anchor";
import { Metrom } from "../target/types/metrom";
import {
    initializeMetrom,
    initializeTestState,
    fundAccount,
} from "./support/fixtures";
import { Keypair, PublicKey } from "@solana/web3.js";
import { expect } from "chai";

describe("Accept ownership", () => {
    let program: Program<Metrom>;

    beforeEach(async () => {
        program = await initializeTestState();
    });

    it("Fails when forbidden", async () => {
        await initializeMetrom({
            program,
            updater: program.provider.wallet.publicKey,
            fee: 15_000,
            minimumCampaignDuration: 10,
            maximumCampaignDuration: 20,
        });

        const signer = Keypair.generate();
        await fundAccount({
            program,
            account: signer.publicKey,
            amount: 1_000_000,
        });

        await program.methods
            .acceptOwnership()
            .accounts({
                signer: signer.publicKey,
            })
            .signers([signer])
            .rpc()
            .should.eventually.be.rejectedWith("Forbidden");
    });

    it("Succeeds", async () => {
        await initializeMetrom({
            program,
            updater: program.provider.wallet.publicKey,
            fee: 15_000,
            minimumCampaignDuration: 10,
            maximumCampaignDuration: 20,
        });

        const newOwner = Keypair.generate();
        await fundAccount({
            program,
            account: newOwner.publicKey,
            amount: 1_000_000,
        });

        await program.methods.transferOwnership(newOwner.publicKey).rpc();
        await program.methods
            .acceptOwnership()
            .accounts({ signer: newOwner.publicKey })
            .signers([newOwner])
            .rpc();

        const state = await program.account.state.fetch(
            PublicKey.findProgramAddressSync(
                [Buffer.from("state")],
                program.programId
            )[0]
        );
        expect(state.owner).to.be.deep.equal(newOwner.publicKey);
        expect(state.pendingOwner).to.be.null;
    });
});
