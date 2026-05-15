import { Program, web3 } from "@coral-xyz/anchor";
import { Metrom } from "../target/types/metrom";
import {
    initializeMetrom,
    initializeTestState,
    fundAccount,
    setMaximumCampaignDuration,
} from "./support/fixtures";
import { expect } from "chai";

describe("Set maximum campaign duration", () => {
    let program: Program<Metrom>;

    beforeEach(async () => {
        program = await initializeTestState();
    });

    it("Fails when invalid 1", async () => {
        const minimumCampaignDuration = 10;

        await initializeMetrom({
            program,
            updater: program.provider.wallet.publicKey,
            fee: 15_000,
            minimumCampaignDuration,
            maximumCampaignDuration: 20,
        });

        return await setMaximumCampaignDuration({
            program,
            duration: minimumCampaignDuration,
        }).should.eventually.be.rejectedWith("InvalidMaximumCampaignDuration");
    });

    it("Fails when invalid 2", async () => {
        const minimumCampaignDuration = 10;

        await initializeMetrom({
            program,
            updater: program.provider.wallet.publicKey,
            fee: 15_000,
            minimumCampaignDuration,
            maximumCampaignDuration: 20,
        });

        return await setMaximumCampaignDuration({
            program,
            duration: minimumCampaignDuration - 1,
        }).should.eventually.be.rejectedWith("InvalidMaximumCampaignDuration");
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
            .setMaximumCampaignDuration(60)
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

        await setMaximumCampaignDuration({ program, duration: 30 });

        const state = await program.account.state.fetch(
            web3.PublicKey.findProgramAddressSync(
                [Buffer.from("state")],
                program.programId
            )[0]
        );
        expect(state.maximumCampaignDuration).to.be.deep.equal(30);
    });
});
