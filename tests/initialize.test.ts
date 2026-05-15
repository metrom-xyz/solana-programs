import { Program, web3 } from "@coral-xyz/anchor";
import { Metrom } from "../target/types/metrom";
import { expect } from "chai";
import { initializeMetrom, initializeTestState } from "./support/fixtures";

describe("Initialize", () => {
    let program: Program<Metrom>;

    beforeEach(async () => {
        program = await initializeTestState();
    });

    it("Rejects invalid fee values", async () => {
        return await initializeMetrom({
            program,
            updater: web3.Keypair.generate().publicKey,
            fee: 1_000_000,
            minimumCampaignDuration: 1,
            maximumCampaignDuration: 1,
        }).should.eventually.be.rejectedWith("InvalidFee");
    });

    it("Rejects invalid minimum campaign duration values", async () => {
        return await initializeMetrom({
            program,
            updater: web3.Keypair.generate().publicKey,
            fee: 10_000,
            minimumCampaignDuration: 20,
            maximumCampaignDuration: 10,
        }).should.eventually.be.rejectedWith("InvalidMinimumCampaignDuration");
    });

    it("Does not allow reinitialization", async () => {
        const updater = web3.Keypair.generate();

        await initializeMetrom({
            program,
            updater: updater.publicKey,
            fee: 10_000,
            minimumCampaignDuration: 10,
            maximumCampaignDuration: 20,
        });

        const state = await program.account.state.fetch(
            web3.PublicKey.findProgramAddressSync(
                [Buffer.from("state")],
                program.programId
            )[0]
        );

        expect(state.owner).to.be.deep.equal(program.provider.publicKey);
        expect(state.pendingOwner).to.be.null;
        expect(state.updater).to.be.deep.equal(updater.publicKey);
        expect(state.fee).to.be.deep.equal(10_000);
        expect(state.minimumCampaignDuration).to.be.deep.equal(10);
        expect(state.maximumCampaignDuration).to.be.deep.equal(20);

        return await initializeMetrom({
            program,
            updater: updater.publicKey,
            fee: 10_000,
            minimumCampaignDuration: 10,
            maximumCampaignDuration: 30,
        }).should.eventually.be.rejected;
    });
});
