import { Program } from "@coral-xyz/anchor";
import { Metrom } from "../target/types/metrom";
import {
    initializeMetrom,
    initializeTestState,
    fundAccount,
    setMaximumCampaignDuration,
    setMinimumCampaignDuration,
} from "./support/fixtures";
import { Keypair, PublicKey } from "@solana/web3.js";
import { expect } from "chai";

describe("Set minimum campaign duration", () => {
    let program: Program<Metrom>;

    beforeEach(async () => {
        program = await initializeTestState();
    });

    it("Fails when invalid 1", async () => {
        const maximumCampaignDuration = 20;

        await initializeMetrom({
            program,
            updater: program.provider.wallet.publicKey,
            fee: 15_000,
            minimumCampaignDuration: 10,
            maximumCampaignDuration,
        });

        return await setMinimumCampaignDuration({
            program,
            duration: maximumCampaignDuration,
        }).should.eventually.be.rejectedWith("InvalidMinimumCampaignDuration");
    });

    it("Fails when invalid 2", async () => {
        const maximumCampaignDuration = 20;

        await initializeMetrom({
            program,
            updater: program.provider.wallet.publicKey,
            fee: 15_000,
            minimumCampaignDuration: 10,
            maximumCampaignDuration,
        });

        return await setMinimumCampaignDuration({
            program,
            duration: maximumCampaignDuration + 1,
        }).should.eventually.be.rejectedWith("InvalidMinimumCampaignDuration");
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
            .setMinimumCampaignDuration(15)
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

        await setMaximumCampaignDuration({ program, duration: 21 });

        const state = await program.account.state.fetch(
            PublicKey.findProgramAddressSync(
                [Buffer.from("state")],
                program.programId
            )[0]
        );
        expect(state.maximumCampaignDuration).to.be.deep.equal(21);
    });
});
