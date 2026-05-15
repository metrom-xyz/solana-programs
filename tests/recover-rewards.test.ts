import { Program } from "@coral-xyz/anchor";
import { Metrom } from "../target/types/metrom";
import {
    initializeMetrom,
    initializeTestState,
    createRewardsCampaign,
} from "./support/fixtures";
import {
    getAssociatedTokenAddressSync,
    TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { BN } from "bn.js";

describe("Recover rewards", () => {
    let program: Program<Metrom>;

    beforeEach(async () => {
        program = await initializeTestState();
    });

    it("Fails with zero amount", async () => {
        await initializeMetrom({
            program,
            updater: program.provider.wallet.publicKey,
            fee: 10_000,
            minimumCampaignDuration: 10,
            maximumCampaignDuration: 20,
        });

        const now = Math.floor(Date.now() / 1_000);

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
            .accounts({ campaign: campaign.id })
            .rpc();

        await program.methods
            .recoverReward([new Array(32).fill(0)] as number[][], new BN(0))
            .accounts({
                mint: campaign.mint,
                campaign: campaign.id,
                receiverTokenAccount: getAssociatedTokenAddressSync(
                    campaign.mint,
                    program.provider.wallet.publicKey
                ),
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .rpc()
            .should.eventually.be.rejectedWith("NoRewardAmount");
    });

    it("Fails with no root", async () => {
        await initializeMetrom({
            program,
            updater: program.provider.wallet.publicKey,
            fee: 10_000,
            minimumCampaignDuration: 10,
            maximumCampaignDuration: 20,
        });

        const now = Math.floor(Date.now() / 1_000);

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
            .recoverReward([new Array(32).fill(0)] as number[][], new BN(10))
            .accounts({
                mint: campaign.mint,
                campaign: campaign.id,
                receiverTokenAccount: getAssociatedTokenAddressSync(
                    campaign.mint,
                    program.provider.wallet.publicKey
                ),
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .rpc()
            .should.eventually.be.rejectedWith("NoRoot");
    });

    it("Fails with an invalid proof", async () => {
        await initializeMetrom({
            program,
            updater: program.provider.wallet.publicKey,
            fee: 10_000,
            minimumCampaignDuration: 10,
            maximumCampaignDuration: 20,
        });

        const now = Math.floor(Date.now() / 1_000);

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
            .accounts({ campaign: campaign.id })
            .rpc();

        await program.methods
            .recoverReward([new Array(32).fill(0)] as number[][], new BN(10))
            .accounts({
                mint: campaign.mint,
                campaign: campaign.id,
                receiverTokenAccount: getAssociatedTokenAddressSync(
                    campaign.mint,
                    program.provider.wallet.publicKey
                ),
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .rpc()
            .should.eventually.be.rejectedWith("InvalidProof");
    });
});
