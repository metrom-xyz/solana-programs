import { Program } from "@coral-xyz/anchor";
import { Metrom } from "../target/types/metrom";
import {
    initializeMetrom,
    initializeTestState,
    fundAccount,
    createRewardsCampaign,
    createMint,
} from "./support/fixtures";
import { Keypair } from "@solana/web3.js";
import { expect } from "chai";

describe("Accept campaign ownership", () => {
    let program: Program<Metrom>;

    beforeEach(async () => {
        program = await initializeTestState();
    });

    it("Fails when campaign is non-existent", async () => {
        await initializeMetrom({
            program,
            updater: program.provider.wallet.publicKey,
            fee: 15_000,
            minimumCampaignDuration: 10,
            maximumCampaignDuration: 20,
        });

        await program.methods
            .acceptCampaignOwnership()
            .accounts({
                campaign: Keypair.generate().publicKey,
            })
            .rpc().should.eventually.be.rejected;
    });

    it("Fails when forbidden", async () => {
        await initializeMetrom({
            program,
            updater: program.provider.wallet.publicKey,
            fee: 15_000,
            minimumCampaignDuration: 10,
            maximumCampaignDuration: 20,
        });

        const mint = await createMint({
            program,
            decimals: 6,
        });

        const now = Math.floor(Date.now() / 1_000);
        const from = now + 10;
        const to = now + 20;
        const kind = 1;
        const data = Buffer.from([]);
        const specificationHash: number[] = new Array(32).fill(0);
        const rewardAmount = 1_000_000;

        const campaign = await createRewardsCampaign({
            program,
            from,
            to,
            kind,
            data,
            specificationHash,
            mint,
            rewardAmount,
        });

        const signer = Keypair.generate();
        await fundAccount({
            program,
            account: signer.publicKey,
            amount: 1_000_000,
        });

        await program.methods
            .transferCampaignOwnership(Keypair.generate().publicKey)
            .accounts({ campaign: campaign.id })
            .rpc();

        await program.methods
            .acceptCampaignOwnership()
            .accounts({ campaign: campaign.id })
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

        const mint = await createMint({
            program,
            decimals: 6,
        });

        const now = Math.floor(Date.now() / 1_000);
        const from = now + 10;
        const to = now + 20;
        const kind = 1;
        const data = Buffer.from([]);
        const specificationHash: number[] = new Array(32).fill(0);
        const rewardAmount = 1_000_000;

        const campaign = await createRewardsCampaign({
            program,
            from,
            to,
            kind,
            data,
            specificationHash,
            mint,
            rewardAmount,
        });

        const newOwner = Keypair.generate();
        await fundAccount({
            program,
            account: newOwner.publicKey,
            amount: 1_000_000,
        });

        await program.methods
            .transferCampaignOwnership(newOwner.publicKey)
            .accounts({ campaign: campaign.id })
            .rpc();
        await program.methods
            .acceptCampaignOwnership()
            .accounts({ signer: newOwner.publicKey, campaign: campaign.id })
            .signers([newOwner])
            .rpc();

        const campaignPost = await program.account.campaign.fetch(campaign.id);
        expect(campaignPost.base.owner).to.be.deep.equal(newOwner.publicKey);
        expect(campaignPost.base.pendingOwner).to.be.null;
    });
});
