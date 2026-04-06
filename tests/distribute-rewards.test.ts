import { Program } from "@coral-xyz/anchor";
import { Metrom } from "../target/types/metrom";
import {
    initializeMetrom,
    initializeTestState,
    createRewardsCampaign,
} from "./support/fixtures";
import { Keypair } from "@solana/web3.js";
import { expect } from "chai";

describe("Distribute rewards", () => {
    let program: Program<Metrom>;

    beforeEach(async () => {
        program = await initializeTestState();
    });

    it("Invalid root length", async () => {
        await initializeMetrom({
            program,
            updater: program.provider.wallet.publicKey,
            fee: 15_000,
            minimumCampaignDuration: 10,
            maximumCampaignDuration: 20,
        });

        const now = Math.floor(Date.now() / 1000);

        const campaign = await createRewardsCampaign({
            program,
            from: now + 10,
            to: now + 20,
            kind: 1,
            data: Buffer.from([]),
            specificationHash: new Array(32).fill(0),
            rewardAmount: 1_000_000,
        });

        await program.methods
            .distributeRewards(
                new Array(33).fill(0) as number[],
                new Array(32).fill(0) as number[]
            )
            .accounts({
                campaign: campaign.id,
            })
            .rpc().should.eventually.be.rejected;
    });

    it("Zero root", async () => {
        await initializeMetrom({
            program,
            updater: program.provider.wallet.publicKey,
            fee: 15_000,
            minimumCampaignDuration: 10,
            maximumCampaignDuration: 20,
        });

        const now = Math.floor(Date.now() / 1000);

        const campaign = await createRewardsCampaign({
            program,
            from: now + 10,
            to: now + 20,
            kind: 1,
            data: Buffer.from([]),
            specificationHash: new Array(32).fill(0),
            rewardAmount: 1_000_000,
        });

        await program.methods
            .distributeRewards(
                new Array(32).fill(0) as number[],
                new Array(32).fill(0) as number[]
            )
            .accounts({
                campaign: campaign.id,
            })
            .rpc().should.eventually.be.rejected;
    });

    it("Non existent campaign", async () => {
        await initializeMetrom({
            program,
            updater: program.provider.wallet.publicKey,
            fee: 15_000,
            minimumCampaignDuration: 10,
            maximumCampaignDuration: 20,
        });

        const now = Math.floor(Date.now() / 1000);

        const campaign = await createRewardsCampaign({
            program,
            from: now + 10,
            to: now + 20,
            kind: 1,
            data: Buffer.from([]),
            specificationHash: new Array(32).fill(0),
            rewardAmount: 1_000_000,
        });

        const root = new Array(32).fill(0) as number[];
        root[31] = 1;

        await program.methods
            .distributeRewards(root, new Array(32).fill(0) as number[])
            .accounts({
                campaign: Keypair.generate().publicKey,
            })
            .rpc().should.eventually.be.rejected;
    });

    it("Succeeds", async () => {
        await initializeMetrom({
            program,
            updater: program.provider.wallet.publicKey,
            fee: 15_000,
            minimumCampaignDuration: 10,
            maximumCampaignDuration: 20,
        });

        const now = Math.floor(Date.now() / 1000);

        const campaign = await createRewardsCampaign({
            program,
            from: now + 10,
            to: now + 20,
            kind: 1,
            data: Buffer.from([]),
            specificationHash: new Array(32).fill(0),
            rewardAmount: 1_000_000,
        });

        expect(campaign.root).to.be.null;

        const root = new Array(32).fill(0) as number[];
        root[31] = 1;

        await program.methods
            .distributeRewards(root, new Array(32).fill(0) as number[])
            .accounts({
                campaign: campaign.id,
            })
            .rpc();

        const campaignPostUpdate = await program.account.campaign.fetch(
            campaign.id
        );
        expect(campaignPostUpdate.data.rewards[0].root).to.be.deep.equal(root);
    });
});
