import { Program, web3 } from "@coral-xyz/anchor";
import { Metrom } from "../target/types/metrom";
import {
    createPointsCampaign,
    initializeMetrom,
    initializeTestState,
    createMint,
    setFeeRebate,
} from "./support/fixtures";
import { expect } from "chai";
import { getAccount } from "@solana/spl-token";

describe("Create points campaign", () => {
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

        return await createPointsCampaign({
            program,
            from: 0,
            to: 10,
            kind: 1,
            data: Buffer.from([]),
            specificationHash: new Array(32).fill(0),
            points: 1_000_000,
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

        return await createPointsCampaign({
            program,
            from: now + 10,
            to: now + 15,
            kind: 1,
            data: Buffer.from([]),
            specificationHash: new Array(32).fill(0),
            points: 1_000_000,
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

        return await createPointsCampaign({
            program,
            from: now + 10,
            to: now + 70,
            kind: 1,
            data: Buffer.from([]),
            specificationHash: new Array(32).fill(0),
            points: 1_000_000,
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

        return await createPointsCampaign({
            program,
            from: now + 10,
            to: now + 20,
            kind: 1,
            data: Buffer.from([]),
            specificationHash: new Array(32).fill(0),
            mint: web3.Keypair.generate(),
            points: 1_000_000,
        }).should.eventually.be.rejected;
    });

    it("Rejects zero points amount", async () => {
        await initializeMetrom({
            program,
            updater: program.provider.wallet.publicKey,
            fee: 15_000,
            minimumCampaignDuration: 10,
            maximumCampaignDuration: 20,
        });

        const now = Math.floor(Date.now() / 1_000);

        return await createPointsCampaign({
            program,
            from: now + 10,
            to: now + 20,
            kind: 1,
            data: Buffer.from([]),
            specificationHash: new Array(32).fill(0),
            points: 0,
        }).should.eventually.be.rejectedWith("NoPoints");
    });

    it("Rejects too low fee amount", async () => {
        await initializeMetrom({
            program,
            updater: program.provider.wallet.publicKey,
            fee: 15_000,
            minimumCampaignDuration: 10,
            maximumCampaignDuration: 20,
        });

        const now = Math.floor(Date.now() / 1_000);

        return await createPointsCampaign({
            program,
            from: now + 10,
            to: now + 20,
            kind: 1,
            data: Buffer.from([]),
            specificationHash: new Array(32).fill(0),
            points: 10,
            minimumFeeTokenRate: 100_000_000,
        }).should.eventually.be.rejected;
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
        const points = 1_000_000;
        const minimumFeeTokenRate = 10_000;

        const expectedFeeAmount = Math.floor(
            (minimumFeeTokenRate * (to - from)) / (60 * 60)
        );

        const campaign = await createPointsCampaign({
            program,
            from,
            to,
            kind,
            data,
            specificationHash,
            mint,
            points,
            minimumFeeTokenRate,
        });

        expect(campaign.owner).to.be.deep.equal(program.provider.publicKey);
        expect(campaign.pendingOwner).to.be.null;
        expect(campaign.from.toNumber()).to.be.deep.equal(from);
        expect(campaign.duration.toNumber()).to.be.deep.equal(to - from);
        expect(campaign.kind).to.be.deep.equal(kind);
        expect(campaign.data).to.be.deep.equal(data);
        expect(campaign.specificationHash).to.be.null;
        expect(campaign.points.toNumber()).to.be.deep.equal(points);

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
        expect(programTokenAccount.amount).to.be.deep.equal(
            BigInt(expectedFeeAmount)
        );

        const claimableFee = await program.account.claimableFee.fetch(
            web3.PublicKey.findProgramAddressSync(
                [Buffer.from("claimable_fee"), mint.publicKey.toBuffer()],
                program.programId
            )[0]
        );
        expect(claimableFee.claimable.toNumber()).to.be.deep.equal(
            expectedFeeAmount
        );
    });

    it("Succeeds with 50% fee rebate", async () => {
        const fee = 15_000;

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
        const points = 1_000_000;
        const minimumFeeTokenRate = 10_000;

        const expectedFeeAmount = Math.floor(
            (minimumFeeTokenRate * (to - from)) / (60 * 60) / 2
        );

        const campaign = await createPointsCampaign({
            program,
            from,
            to,
            kind,
            data,
            specificationHash,
            mint,
            points,
            minimumFeeTokenRate,
        });

        expect(campaign.owner).to.be.deep.equal(program.provider.publicKey);
        expect(campaign.pendingOwner).to.be.null;
        expect(campaign.from.toNumber()).to.be.deep.equal(from);
        expect(campaign.duration.toNumber()).to.be.deep.equal(to - from);
        expect(campaign.kind).to.be.deep.equal(kind);
        expect(campaign.data).to.be.deep.equal(data);
        expect(campaign.specificationHash).to.be.null;
        expect(campaign.points.toNumber()).to.be.deep.equal(points);

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
        expect(programTokenAccount.amount).to.be.deep.equal(
            BigInt(expectedFeeAmount)
        );

        const claimableFee = await program.account.claimableFee.fetch(
            web3.PublicKey.findProgramAddressSync(
                [Buffer.from("claimable_fee"), mint.publicKey.toBuffer()],
                program.programId
            )[0]
        );
        expect(claimableFee.claimable.toNumber()).to.be.deep.equal(
            expectedFeeAmount
        );
    });

    it("Succeeds with 100% fee rebate", async () => {
        const fee = 15_000;

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
        const points = 1_000_000;
        const minimumFeeTokenRate = 10_000;

        const campaign = await createPointsCampaign({
            program,
            from,
            to,
            kind,
            data,
            specificationHash,
            mint,
            points,
            minimumFeeTokenRate,
        });

        expect(campaign.owner).to.be.deep.equal(program.provider.publicKey);
        expect(campaign.pendingOwner).to.be.null;
        expect(campaign.from.toNumber()).to.be.deep.equal(from);
        expect(campaign.duration.toNumber()).to.be.deep.equal(to - from);
        expect(campaign.kind).to.be.deep.equal(kind);
        expect(campaign.data).to.be.deep.equal(data);
        expect(campaign.specificationHash).to.be.null;
        expect(campaign.points.toNumber()).to.be.deep.equal(points);

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
        expect(programTokenAccount.amount).to.be.deep.equal(BigInt(0));

        const claimableFee = await program.account.claimableFee.fetch(
            web3.PublicKey.findProgramAddressSync(
                [Buffer.from("claimable_fee"), mint.publicKey.toBuffer()],
                program.programId
            )[0]
        );
        expect(claimableFee.claimable.toNumber()).to.be.deep.equal(0);
    });
});
