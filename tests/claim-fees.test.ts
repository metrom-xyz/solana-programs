import { Program, web3 } from "@coral-xyz/anchor";
import { Metrom } from "../target/types/metrom";
import {
    initializeMetrom,
    initializeTestState,
    fundAccount,
    createRewardsCampaign,
    createAssociatedTokenAccount,
    createMint,
} from "./support/fixtures";
import { expect } from "chai";
import {
    getAccount,
    getAssociatedTokenAddressSync,
    TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

describe("Claim fees", () => {
    let program: Program<Metrom>;

    beforeEach(async () => {
        program = await initializeTestState();
    });

    it("Fails when forbidden", async () => {
        await initializeMetrom({
            program,
            updater: program.provider.wallet.publicKey,
            fee: 15_000,
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

        const signer = web3.Keypair.generate();
        await fundAccount({
            program,
            account: signer.publicKey,
            amount: 1_000_000,
        });
        const receiverTokenAccount = await createAssociatedTokenAccount({
            program,
            owner: signer.publicKey,
            mint: campaign.mint,
        });

        await program.methods
            .claimFee()
            .accounts({
                mint: campaign.mint,
                receiverTokenAccount,
                signer: signer.publicKey,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([signer])
            .rpc()
            .should.eventually.be.rejectedWith("Forbidden");
    });

    it("Fails with an invalid fee token", async () => {
        await initializeMetrom({
            program,
            updater: program.provider.wallet.publicKey,
            fee: 15_000,
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

        const signer = web3.Keypair.generate();
        await fundAccount({
            program,
            account: signer.publicKey,
            amount: 1_000_000,
        });
        const receiverTokenAccount = await createAssociatedTokenAccount({
            program,
            owner: signer.publicKey,
            mint: campaign.mint,
        });

        await program.methods
            .claimFee()
            .accounts({
                mint: web3.Keypair.generate().publicKey,
                receiverTokenAccount,
                signer: signer.publicKey,
            })
            .signers([signer])
            .rpc().should.eventually.be.rejected;
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

        const feeAmount = (rewardAmount * fee) / 1_000_000;

        const claimableFee = await program.account.claimableFee.fetch(
            web3.PublicKey.findProgramAddressSync(
                [Buffer.from("claimable_fee"), mint.publicKey.toBuffer()],
                program.programId
            )[0]
        );
        expect(claimableFee.claimable.toNumber()).to.be.deep.equal(feeAmount);

        const signerTokenAccountAddress = getAssociatedTokenAddressSync(
            campaign.mint,
            program.provider.wallet.publicKey
        );
        const signerTokenAccount = await getAccount(
            program.provider.connection,
            signerTokenAccountAddress
        );
        const signerTokenAccountBalancePre = signerTokenAccount.amount;

        await program.methods
            .claimFee()
            .accounts({
                mint: campaign.mint,
                receiverTokenAccount: signerTokenAccountAddress,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .rpc();

        const claimableFeePost = await program.account.claimableFee.fetch(
            web3.PublicKey.findProgramAddressSync(
                [Buffer.from("claimable_fee"), mint.publicKey.toBuffer()],
                program.programId
            )[0]
        );
        expect(claimableFeePost.claimable.toNumber()).to.be.deep.equal(0);

        const signerTokenAccountPost = await getAccount(
            program.provider.connection,
            signerTokenAccountAddress
        );
        expect(
            signerTokenAccountPost.amount - signerTokenAccountBalancePre
        ).to.be.deep.equal(BigInt(feeAmount));
    });
});
