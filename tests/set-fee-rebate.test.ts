import { Program, web3 } from "@coral-xyz/anchor";
import { Metrom } from "../target/types/metrom";
import {
    initializeMetrom,
    initializeTestState,
    setFeeRebate,
    fundAccount,
} from "./support/fixtures";
import { expect } from "chai";

describe("Set fee rebate", () => {
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

        return await setFeeRebate({
            program,
            account: program.provider.wallet.publicKey,
            rebate: 1_000_001,
        }).should.eventually.be.rejectedWith("InvalidRebate");
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
            .setFeeRebate(web3.Keypair.generate().publicKey, 500_000)
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

        await setFeeRebate({
            program,
            account: program.provider.wallet.publicKey,
            rebate: 500_000,
        });

        const feeRebate = await program.account.feeRebate.fetch(
            web3.PublicKey.findProgramAddressSync(
                [
                    Buffer.from("fee_rebate"),
                    program.provider.wallet.publicKey.toBuffer(),
                ],
                program.programId
            )[0]
        );
        expect(feeRebate.rebate).to.be.deep.equal(500_000);
    });
});
