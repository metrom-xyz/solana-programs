import { Program, web3 } from "@coral-xyz/anchor";
import { Metrom } from "../target/types/metrom";
import {
    initializeMetrom,
    initializeTestState,
    fundAccount,
} from "./support/fixtures";
import { expect } from "chai";

describe("Set updater", () => {
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

        const signer = web3.Keypair.generate();
        await fundAccount({
            program,
            account: signer.publicKey,
            amount: 1_000_000,
        });

        await program.methods
            .setUpdater(web3.Keypair.generate().publicKey)
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

        const newUpdater = web3.Keypair.generate().publicKey;

        await program.methods.setUpdater(newUpdater).rpc();

        const state = await program.account.state.fetch(
            web3.PublicKey.findProgramAddressSync(
                [Buffer.from("state")],
                program.programId
            )[0]
        );
        expect(state.updater).to.be.deep.equal(newUpdater);
    });
});
