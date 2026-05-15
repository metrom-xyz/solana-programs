import { Program, web3 } from "@coral-xyz/anchor";
import { Metrom } from "../target/types/metrom";
import {
    createRewardsCampaign,
    initializeMetrom,
    initializeTestState,
    createMint,
    setFeeRebate,
} from "./support/fixtures";
import { expect } from "chai";
import { getAccount } from "@solana/spl-token";

describe("Create reward campaign", () => {
    let program: Program<Metrom>;

    beforeEach(async () => {
        program = await initializeTestState();
    });

    it("Rejects campaigns starting in the past", async () => {
        await initializeMetrom({
            program,
            updater: program.provider.wallet.publicKey,
            fee: 15_000,
            minimumCampaignDuration: 10,
            maximumCampaignDuration: 20,
        });

        return await createRewardsCampaign({
            program,
            from: 0,
            to: 10,
            kind: 1,
            data: Buffer.from([]),
            specificationHash: new Array(32).fill(0),
            rewardAmount: 1_000_000,
        }).should.eventually.be.rejectedWith("InvalidStartTime");
    });

    it("Rejects campaigns with invalid minimum duration", async () => {
        await initializeMetrom({
            program,
            updater: program.provider.wallet.publicKey,
            fee: 15_000,
            minimumCampaignDuration: 10,
            maximumCampaignDuration: 20,
        });

        const now = Math.floor(Date.now() / 1_000);

        return await createRewardsCampaign({
            program,
            from: now + 10,
            to: now + 15,
            kind: 1,
            data: Buffer.from([]),
            specificationHash: new Array(32).fill(0),
            rewardAmount: 1_000_000,
        }).should.eventually.be.rejectedWith("InvalidDuration");
    });

    it("Rejects campaigns with invalid maximum duration", async () => {
        await initializeMetrom({
            program,
            updater: program.provider.wallet.publicKey,
            fee: 15_000,
            minimumCampaignDuration: 10,
            maximumCampaignDuration: 20,
        });

        const now = Math.floor(Date.now() / 1_000);

        return await createRewardsCampaign({
            program,
            from: now + 10,
            to: now + 70,
            kind: 1,
            data: Buffer.from([]),
            specificationHash: new Array(32).fill(0),
            rewardAmount: 1_000_000,
        }).should.eventually.be.rejectedWith("InvalidDuration");
    });

    it("Rejects invalid mint", async () => {
        await initializeMetrom({
            program,
            updater: program.provider.wallet.publicKey,
            fee: 15_000,
            minimumCampaignDuration: 10,
            maximumCampaignDuration: 20,
        });

        const now = Math.floor(Date.now() / 1_000);

        return await createRewardsCampaign({
            program,
            from: now + 10,
            to: now + 20,
            kind: 1,
            data: Buffer.from([]),
            specificationHash: new Array(32).fill(0),
            mint: web3.Keypair.generate(),
            rewardAmount: 1_000_000,
        }).should.eventually.be.rejected;
    });

    it("Rejects zero rewards amount", async () => {
        await initializeMetrom({
            program,
            updater: program.provider.wallet.publicKey,
            fee: 15_000,
            minimumCampaignDuration: 10,
            maximumCampaignDuration: 20,
        });

        const now = Math.floor(Date.now() / 1_000);

        return await createRewardsCampaign({
            program,
            from: now + 10,
            to: now + 20,
            kind: 1,
            data: Buffer.from([]),
            specificationHash: new Array(32).fill(0),
            rewardAmount: 0,
        }).should.eventually.be.rejectedWith("RewardAmountTooLow");
    });

    it("Rejects too low rewards amount", async () => {
        await initializeMetrom({
            program,
            updater: program.provider.wallet.publicKey,
            fee: 15_000,
            minimumCampaignDuration: 10,
            maximumCampaignDuration: 20,
        });

        const now = Math.floor(Date.now() / 1_000);

        return await createRewardsCampaign({
            program,
            from: now + 10,
            to: now + 20,
            kind: 1,
            data: Buffer.from([]),
            specificationHash: new Array(32).fill(0),
            rewardAmount: 10,
            minimumRewardTokenRate: 1_000_000,
        }).should.eventually.be.rejectedWith("RewardAmountTooLow");
    });

    it("Succeeds", async () => {
        const fee = 15_000;

        await initializeMetrom({
            program,
            updater: program.provider.wallet.publicKey,
            fee,
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

        expect(campaign.owner).to.be.deep.equal(program.provider.publicKey);
        expect(campaign.pendingOwner).to.be.null;
        expect(campaign.from.toNumber()).to.be.deep.equal(from);
        expect(campaign.duration.toNumber()).to.be.deep.equal(to - from);
        expect(campaign.kind).to.be.deep.equal(kind);
        expect(campaign.data).to.be.deep.equal(data);
        expect(campaign.specificationHash).to.be.null;
        expect(campaign.root).to.be.null;
        expect(campaign.mint).to.be.deep.equal(mint.publicKey);

        const feeAmount = (rewardAmount * fee) / 1_000_000;
        expect(campaign.rewardAmount.toNumber()).to.be.deep.equal(
            rewardAmount - feeAmount
        );

        const programTokenAccount = await getAccount(
            program.provider.connection,
            web3.PublicKey.findProgramAddressSync(
                [
                    Buffer.from("treasury_token_account"),
                    mint.publicKey.toBuffer(),
                ],
                program.programId
            )[0]
        );
        expect(programTokenAccount.amount).to.be.deep.equal(BigInt(1_000_000));

        const claimableFee = await program.account.claimableFee.fetch(
            web3.PublicKey.findProgramAddressSync(
                [Buffer.from("claimable_fee"), mint.publicKey.toBuffer()],
                program.programId
            )[0]
        );
        expect(claimableFee.claimable.toNumber()).to.be.deep.equal(feeAmount);
    });

    it("Succeeds with 50% fee rebate", async () => {
        const fee = 10_000;

        await initializeMetrom({
            program,
            updater: program.provider.wallet.publicKey,
            fee,
            minimumCampaignDuration: 10,
            maximumCampaignDuration: 20,
        });

        await setFeeRebate({
            program,
            account: program.provider.wallet.publicKey,
            rebate: 500_000,
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

        expect(campaign.owner).to.be.deep.equal(program.provider.publicKey);
        expect(campaign.pendingOwner).to.be.null;
        expect(campaign.from.toNumber()).to.be.deep.equal(from);
        expect(campaign.duration.toNumber()).to.be.deep.equal(to - from);
        expect(campaign.kind).to.be.deep.equal(kind);
        expect(campaign.data).to.be.deep.equal(data);
        expect(campaign.specificationHash).to.be.null;
        expect(campaign.root).to.be.null;
        expect(campaign.mint).to.be.deep.equal(mint.publicKey);

        const feeAmount = (rewardAmount * (fee / 2)) / 1_000_000;
        expect(campaign.rewardAmount.toNumber()).to.be.deep.equal(
            rewardAmount - feeAmount
        );

        const programTokenAccount = await getAccount(
            program.provider.connection,
            web3.PublicKey.findProgramAddressSync(
                [
                    Buffer.from("treasury_token_account"),
                    mint.publicKey.toBuffer(),
                ],
                program.programId
            )[0]
        );
        expect(programTokenAccount.amount).to.be.deep.equal(BigInt(1_000_000));

        const claimableFee = await program.account.claimableFee.fetch(
            web3.PublicKey.findProgramAddressSync(
                [Buffer.from("claimable_fee"), mint.publicKey.toBuffer()],
                program.programId
            )[0]
        );
        expect(claimableFee.claimable.toNumber()).to.be.deep.equal(feeAmount);
    });

    it("Succeeds with 100% fee rebate", async () => {
        const fee = 10_000;

        await initializeMetrom({
            program,
            updater: program.provider.wallet.publicKey,
            fee,
            minimumCampaignDuration: 10,
            maximumCampaignDuration: 20,
        });

        await setFeeRebate({
            program,
            account: program.provider.wallet.publicKey,
            rebate: 1_000_000,
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

        expect(campaign.owner).to.be.deep.equal(program.provider.publicKey);
        expect(campaign.pendingOwner).to.be.null;
        expect(campaign.from.toNumber()).to.be.deep.equal(from);
        expect(campaign.duration.toNumber()).to.be.deep.equal(to - from);
        expect(campaign.kind).to.be.deep.equal(kind);
        expect(campaign.data).to.be.deep.equal(data);
        expect(campaign.specificationHash).to.be.null;
        expect(campaign.root).to.be.null;
        expect(campaign.mint).to.be.deep.equal(mint.publicKey);
        expect(campaign.rewardAmount.toNumber()).to.be.deep.equal(rewardAmount);

        const programTokenAccount = await getAccount(
            program.provider.connection,
            web3.PublicKey.findProgramAddressSync(
                [
                    Buffer.from("treasury_token_account"),
                    mint.publicKey.toBuffer(),
                ],
                program.programId
            )[0]
        );
        expect(programTokenAccount.amount).to.be.deep.equal(BigInt(1_000_000));

        const claimableFee = await program.account.claimableFee.fetch(
            web3.PublicKey.findProgramAddressSync(
                [Buffer.from("claimable_fee"), mint.publicKey.toBuffer()],
                program.programId
            )[0]
        );
        expect(claimableFee.claimable.toNumber()).to.be.deep.equal(0);
    });
});
