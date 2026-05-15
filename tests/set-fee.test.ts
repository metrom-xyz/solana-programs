import { Program, web3 } from "@coral-xyz/anchor";
import { Metrom } from "../target/types/metrom";
import {
    initializeMetrom,
    initializeTestState,
    fundAccount,
    setFee,
} from "./support/fixtures";
import { expect } from "chai";

describe("Set fee", () => {
    let program: Program<Metrom>;

    beforeEach(async () => {
        program = await initializeTestState();
    });

    it("Fails when invalid", async () => {
        await initializeMetrom({
            program,
            updater: program.provider.wallet.publicKey,
            fee: 15_000,
            minimumCampaignDuration: 10,
            maximumCampaignDuration: 20,
        });

        return await setFee({
            program,
            fee: 1_000_000,
        }).should.eventually.be.rejectedWith("InvalidFee");
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
            .setFee(500_000)
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

        await setFee({ program, fee: 500_000 });

        const state = await program.account.state.fetch(
            web3.PublicKey.findProgramAddressSync(
                [Buffer.from("state")],
                program.programId
            )[0]
        );
        expect(state.fee).to.be.deep.equal(500_000);
    });
});
