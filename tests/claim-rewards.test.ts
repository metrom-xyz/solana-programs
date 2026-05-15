import { Program, web3 } from "@coral-xyz/anchor";
import { Metrom } from "../target/types/metrom";
import {
    initializeMetrom,
    initializeTestState,
    createRewardsCampaign,
    createMint,
    fundAccount,
    createAssociatedTokenAccount,
} from "./support/fixtures";
import { expect } from "chai";
import {
    getAccount,
    getAssociatedTokenAddressSync,
    TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { BN } from "bn.js";
import { hexTo32Array } from "./support/utils";

describe("Claim rewards", () => {
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
            .claimReward([new Array(32).fill(0)] as number[][], new BN(0))
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
            .claimReward([new Array(32).fill(0)] as number[][], new BN(10))
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
            .claimReward([new Array(32).fill(0)] as number[][], new BN(10))
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

    it("Fails with too much amount", async () => {
        await initializeMetrom({
            program,
            updater: program.provider.wallet.publicKey,
            fee: 10_000,
            minimumCampaignDuration: 10,
            maximumCampaignDuration: 20,
        });

        const mint = await createMint({
            program,
            decimals: 6,
            keyPairSeed: Uint8Array.from(new Array(32).fill(0)),
        });

        const now = Math.floor(Date.now() / 1_000);

        const campaign = await createRewardsCampaign({
            program,
            from: now + 10,
            to: now + 20,
            kind: 1,
            data: Buffer.from([]),
            specificationHash: new Array(32).fill(0),
            rewardAmount: 10_000_000_000,
            mint,
        });

        const signer = web3.Keypair.fromSeed(
            Uint8Array.from(new Array(32).fill(1))
        );
        await fundAccount({
            program,
            account: signer.publicKey,
            amount: 10_000_000,
        });

        const receiverTokenAccount = await createAssociatedTokenAccount({
            program,
            mint: campaign.mint,
            owner: signer.publicKey,
        });

        // the following root is taken by constructing a tree
        // including the following 2 claims:
        // [
        //     {
        //         account: "0x0000000000000000000000000000000000000000000000000000000000000000",
        //         token: "0x3B6A27BCCEB6A42D62A3A8D02A6F0D73653215771DE243A63AC048A18B59DA29",
        //         amount: 900000000
        //     },
        //     {
        //         account: "0x8A88E3DD7409F195FD52DB2D3CBA5D72CA6709BF1D94121BF3748801B40F6F5C",
        //         token: "0x3B6A27BCCEB6A42D62A3A8D02A6F0D73653215771DE243A63AC048A18B59DA29",
        //         amount: 10100000000
        //     }
        // ]
        // then the provided proof at claim time is the one for the second claim

        const root = hexTo32Array(
            "0x86a619dedc8c255dfb2b60ee1f9084a668bc9555e9332c94b572106f5664b16d"
        );

        await program.methods
            .distributeRewards(root, root)
            .accounts({ campaign: campaign.id })
            .rpc();

        await program.methods
            .claimReward(
                [
                    hexTo32Array(
                        "0xff4be33da63ddf90476ee4de42ab0c6861ee083ce7f967f42f3e7f03ff9a8ff2"
                    ),
                ] as number[][],
                new BN(10100000000)
            )
            .accounts({
                mint: campaign.mint,
                campaign: campaign.id,
                receiverTokenAccount,
                tokenProgram: TOKEN_PROGRAM_ID,
                signer: signer.publicKey,
            })
            .signers([signer])
            .rpc()
            .should.eventually.be.rejectedWith(
                "InconsistentClaimedRewardAmount"
            );
    });

    it("Fails when trying to process a claim multiple times", async () => {
        await initializeMetrom({
            program,
            updater: program.provider.wallet.publicKey,
            fee: 10_000,
            minimumCampaignDuration: 10,
            maximumCampaignDuration: 20,
        });

        const mint = await createMint({
            program,
            decimals: 6,
            keyPairSeed: Uint8Array.from(new Array(32).fill(0)),
        });

        const now = Math.floor(Date.now() / 1_000);

        const campaign = await createRewardsCampaign({
            program,
            from: now + 10,
            to: now + 20,
            kind: 1,
            data: Buffer.from([]),
            specificationHash: new Array(32).fill(0),
            rewardAmount: 20_000_000_000,
            mint,
        });

        const signer = web3.Keypair.fromSeed(
            Uint8Array.from(new Array(32).fill(1))
        );
        await fundAccount({
            program,
            account: signer.publicKey,
            amount: 10_000_000,
        });

        const receiverTokenAccount = await createAssociatedTokenAccount({
            program,
            mint: campaign.mint,
            owner: signer.publicKey,
        });

        // the following root is taken by constructing a tree
        // including the following 2 claims:
        // [
        //     {
        //         account: "0x0000000000000000000000000000000000000000000000000000000000000000",
        //         token: "0x3B6A27BCCEB6A42D62A3A8D02A6F0D73653215771DE243A63AC048A18B59DA29",
        //         amount: 900000000
        //     },
        //     {
        //         account: "0x8A88E3DD7409F195FD52DB2D3CBA5D72CA6709BF1D94121BF3748801B40F6F5C",
        //         token: "0x3B6A27BCCEB6A42D62A3A8D02A6F0D73653215771DE243A63AC048A18B59DA29",
        //         amount: 10100000000
        //     }
        // ]
        // then the provided proof at claim time is the one for the second claim

        const root = hexTo32Array(
            "0x86a619dedc8c255dfb2b60ee1f9084a668bc9555e9332c94b572106f5664b16d"
        );

        await program.methods
            .distributeRewards(root, root)
            .accounts({ campaign: campaign.id })
            .rpc();

        await program.methods
            .claimReward(
                [
                    hexTo32Array(
                        "0xff4be33da63ddf90476ee4de42ab0c6861ee083ce7f967f42f3e7f03ff9a8ff2"
                    ),
                ] as number[][],
                new BN(10100000000)
            )
            .accounts({
                mint: campaign.mint,
                campaign: campaign.id,
                receiverTokenAccount,
                tokenProgram: TOKEN_PROGRAM_ID,
                signer: signer.publicKey,
            })
            .signers([signer])
            .rpc();

        await program.methods
            .claimReward(
                [
                    hexTo32Array(
                        "0xff4be33da63ddf90476ee4de42ab0c6861ee083ce7f967f42f3e7f03ff9a8ff2"
                    ),
                ] as number[][],
                new BN(10100000000)
            )
            .accounts({
                mint: campaign.mint,
                campaign: campaign.id,
                receiverTokenAccount,
                tokenProgram: TOKEN_PROGRAM_ID,
                signer: signer.publicKey,
            })
            .signers([signer])
            .rpc()
            .should.eventually.be.rejectedWith("NoRewardAmount");
    });

    it("Succeeds", async () => {
        await initializeMetrom({
            program,
            updater: program.provider.wallet.publicKey,
            fee: 10_000,
            minimumCampaignDuration: 10,
            maximumCampaignDuration: 20,
        });

        const mint = await createMint({
            program,
            decimals: 6,
            keyPairSeed: Uint8Array.from(new Array(32).fill(0)),
        });

        const now = Math.floor(Date.now() / 1_000);

        const campaign = await createRewardsCampaign({
            program,
            from: now + 10,
            to: now + 20,
            kind: 1,
            data: Buffer.from([]),
            specificationHash: new Array(32).fill(0),
            rewardAmount: 20_000_000_000,
            mint,
        });

        const signer = web3.Keypair.fromSeed(
            Uint8Array.from(new Array(32).fill(1))
        );
        await fundAccount({
            program,
            account: signer.publicKey,
            amount: 10_000_000,
        });

        const receiverTokenAccount = await createAssociatedTokenAccount({
            program,
            mint: campaign.mint,
            owner: signer.publicKey,
        });

        // the following root is taken by constructing a tree
        // including the following 2 claims:
        // [
        //     {
        //         account: "0x0000000000000000000000000000000000000000000000000000000000000000",
        //         token: "0x3B6A27BCCEB6A42D62A3A8D02A6F0D73653215771DE243A63AC048A18B59DA29",
        //         amount: 900000000
        //     },
        //     {
        //         account: "0x8A88E3DD7409F195FD52DB2D3CBA5D72CA6709BF1D94121BF3748801B40F6F5C",
        //         token: "0x3B6A27BCCEB6A42D62A3A8D02A6F0D73653215771DE243A63AC048A18B59DA29",
        //         amount: 10100000000
        //     }
        // ]
        // then the provided proof at claim time is the one for the second claim

        const root = hexTo32Array(
            "0x86a619dedc8c255dfb2b60ee1f9084a668bc9555e9332c94b572106f5664b16d"
        );

        await program.methods
            .distributeRewards(root, root)
            .accounts({ campaign: campaign.id })
            .rpc();

        await program.methods
            .claimReward(
                [
                    hexTo32Array(
                        "0xff4be33da63ddf90476ee4de42ab0c6861ee083ce7f967f42f3e7f03ff9a8ff2"
                    ),
                ] as number[][],
                new BN(10100000000)
            )
            .accounts({
                mint: campaign.mint,
                campaign: campaign.id,
                receiverTokenAccount,
                tokenProgram: TOKEN_PROGRAM_ID,
                signer: signer.publicKey,
            })
            .signers([signer])
            .rpc();

        const receiverTokenAccountPost = await getAccount(
            program.provider.connection,
            receiverTokenAccount
        );
        expect(receiverTokenAccountPost.amount).to.be.deep.equal(
            BigInt(10100000000)
        );

        const claimedReward = await program.account.claimedReward.fetch(
            web3.PublicKey.findProgramAddressSync(
                [
                    Buffer.from("claimed_reward"),
                    signer.publicKey.toBuffer(),
                    campaign.id.toBuffer(),
                ],
                program.programId
            )[0]
        );
        expect(claimedReward.claimed.toNumber()).to.be.deep.equal(10100000000);
    });
});
