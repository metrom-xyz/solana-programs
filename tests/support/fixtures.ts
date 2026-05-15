import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { Metrom } from "../../target/types/metrom";
import IDL from "../../target/idl/metrom.json";
import { Program, web3, setProvider, BN } from "@coral-xyz/anchor";
import { BankrunProvider, startAnchor } from "anchor-bankrun";
import {
    createAssociatedTokenAccountInstruction,
    createInitializeMintInstruction,
    createMintToInstruction,
    getAssociatedTokenAddressSync,
    MINT_SIZE,
    TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { toLe32, toLe64 } from "./utils";

chai.should();
chai.use(chaiAsPromised);

export const UPDATER_KEYPAIR = web3.Keypair.generate();

export async function initializeTestState(): Promise<Program<Metrom>> {
    const context = await startAnchor("", [], []);
    const provider = new BankrunProvider(context);
    setProvider(provider);
    return new Program<Metrom>(IDL, provider);
}

interface FundAccountArgs {
    program: Program<Metrom>;
    account: web3.PublicKey;
    amount: number;
}

export async function fundAccount({
    program,
    account,
    amount,
}: FundAccountArgs): Promise<void> {
    await program.provider.sendAndConfirm(
        new web3.Transaction().add(
            web3.SystemProgram.transfer({
                fromPubkey: program.provider.wallet.publicKey,
                toPubkey: account,
                lamports: amount,
            })
        )
    );
}

interface InitializeMetromArgs {
    program: Program<Metrom>;
    updater: web3.PublicKey;
    fee: number;
    minimumCampaignDuration: number;
    maximumCampaignDuration: number;
}

export async function initializeMetrom({
    program,
    updater,
    fee,
    minimumCampaignDuration,
    maximumCampaignDuration,
}: InitializeMetromArgs) {
    await program.methods
        .initialize(
            updater,
            fee,
            minimumCampaignDuration,
            maximumCampaignDuration
        )
        .rpc();
}

interface SetFeeRebateArgs {
    program: Program<Metrom>;
    account: web3.PublicKey;
    rebate: number;
}

export async function setFeeRebate({
    program,
    account,
    rebate,
}: SetFeeRebateArgs) {
    await program.methods.setFeeRebate(account, rebate).rpc();
}

interface SetFeeArgs {
    program: Program<Metrom>;
    fee: number;
}

export async function setFee({ program, fee }: SetFeeArgs) {
    await program.methods.setFee(fee).rpc();
}

interface SetMaximumCampaignDurationArgs {
    program: Program<Metrom>;
    duration: number;
}

export async function setMaximumCampaignDuration({
    program,
    duration,
}: SetMaximumCampaignDurationArgs) {
    await program.methods.setMaximumCampaignDuration(duration).rpc();
}

interface SetMinimumCampaignDurationArgs {
    program: Program<Metrom>;
    duration: number;
}

export async function setMinimumCampaignDuration({
    program,
    duration,
}: SetMinimumCampaignDurationArgs) {
    await program.methods.setMinimumCampaignDuration(duration).rpc();
}

interface CreateRewardsCampaignArgs {
    program: Program<Metrom>;
    from: number;
    to: number;
    kind: number;
    data: Buffer<ArrayBufferLike>;
    specificationHash: number[];
    mint?: web3.Keypair;
    rewardAmount: number;
    minimumRewardTokenRate?: number;
}

interface RewardsCampaign {
    id: web3.PublicKey;
    owner: web3.PublicKey;
    pendingOwner: web3.PublicKey | null;
    from: BN;
    duration: BN;
    kind: number;
    data: Buffer;
    specificationHash: number[] | null;
    root: number[];
    mint: web3.PublicKey;
    rewardAmount: BN;
}

export async function createRewardsCampaign({
    program,
    from,
    to,
    kind,
    data,
    specificationHash,
    mint,
    rewardAmount,
    minimumRewardTokenRate,
}: CreateRewardsCampaignArgs): Promise<RewardsCampaign> {
    if (!mint) {
        mint = await createMint({
            program,
            decimals: 6,
        });
    }

    await program.methods
        .setMinimumRewardTokenRate(new BN(minimumRewardTokenRate || 1))
        .accounts({
            mint: mint.publicKey,
            signer: program.provider.wallet.publicKey,
        })
        .rpc();

    const senderTokenAccount = await createAssociatedTokenAccount({
        program,
        mint: mint.publicKey,
        owner: program.provider.wallet.publicKey,
    });

    if (rewardAmount > 0)
        await mintTo({
            program,
            mint,
            amount: rewardAmount,
            to: senderTokenAccount,
        });

    await program.methods
        .createRewardsCampaign(
            new BN(from),
            new BN(to),
            kind,
            data,
            specificationHash,
            new BN(rewardAmount)
        )
        .accounts({
            mint: mint.publicKey,
            senderTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

    const campaignId = web3.PublicKey.findProgramAddressSync(
        [
            Buffer.from("campaign"),
            program.provider.wallet.publicKey.toBuffer(),
            toLe64(from),
            toLe64(to),
            toLe32(kind),
            data,
            Buffer.from(specificationHash),
            mint.publicKey.toBuffer(),
            toLe64(rewardAmount),
        ],
        program.programId
    )[0];

    const campaign = await program.account.campaign.fetch(campaignId);

    return {
        id: campaignId,
        owner: campaign.base.owner,
        pendingOwner: campaign.base.pendingOwner,
        from: campaign.base.from,
        duration: campaign.base.duration,
        kind: campaign.base.kind,
        data: campaign.base.data,
        specificationHash: campaign.base.specificationHash,
        root: campaign.data.rewards[0].root,
        mint: campaign.data.rewards[0].mint,
        rewardAmount: campaign.data.rewards[0].amount,
    };
}

interface CreatePointsCampaignArgs {
    program: Program<Metrom>;
    from: number;
    to: number;
    kind: number;
    data: Buffer<ArrayBufferLike>;
    specificationHash: number[];
    mint?: web3.Keypair;
    points: number;
    minimumFeeTokenRate?: number;
}

interface PointsCampaign {
    id: web3.PublicKey;
    owner: web3.PublicKey;
    pendingOwner: web3.PublicKey | null;
    from: BN;
    duration: BN;
    kind: number;
    data: Buffer;
    specificationHash: number[] | null;
    points: BN;
}

export async function createPointsCampaign({
    program,
    from,
    to,
    kind,
    data,
    specificationHash,
    mint,
    points,
    minimumFeeTokenRate,
}: CreatePointsCampaignArgs): Promise<PointsCampaign> {
    if (!mint) {
        mint = await createMint({
            program,
            decimals: 6,
        });
    }

    await program.methods
        .setMinimumFeeTokenRate(new BN(minimumFeeTokenRate || 1))
        .accounts({
            mint: mint.publicKey,
            signer: program.provider.wallet.publicKey,
        })
        .rpc();

    const senderTokenAccount = await createAssociatedTokenAccount({
        program,
        mint: mint.publicKey,
        owner: program.provider.wallet.publicKey,
    });

    await mintTo({
        program,
        mint,
        amount: 10_000,
        to: senderTokenAccount,
    });

    await program.methods
        .createPointsCampaign(
            new BN(from),
            new BN(to),
            kind,
            data,
            specificationHash,
            new BN(points)
        )
        .accounts({
            mint: mint.publicKey,
            senderTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

    const campaignId = web3.PublicKey.findProgramAddressSync(
        [
            Buffer.from("campaign"),
            program.provider.wallet.publicKey.toBuffer(),
            toLe64(from),
            toLe64(to),
            toLe32(kind),
            data,
            Buffer.from(specificationHash),
            mint.publicKey.toBuffer(),
            toLe64(points),
        ],
        program.programId
    )[0];

    const campaign = await program.account.campaign.fetch(campaignId);

    return {
        id: campaignId,
        owner: campaign.base.owner,
        pendingOwner: campaign.base.pendingOwner,
        from: campaign.base.from,
        duration: campaign.base.duration,
        kind: campaign.base.kind,
        data: campaign.base.data,
        specificationHash: campaign.base.specificationHash,
        points: campaign.data.points[0].amount,
    };
}

interface CreateMintArgs {
    program: Program<Metrom>;
    decimals: number;
    keyPairSeed?: Uint8Array;
}

export async function createMint({
    program,
    decimals,
    keyPairSeed,
}: CreateMintArgs): Promise<web3.Keypair> {
    const mint = keyPairSeed
        ? web3.Keypair.fromSeed(keyPairSeed)
        : web3.Keypair.generate();

    const lamports =
        await program.provider.connection.getMinimumBalanceForRentExemption(
            MINT_SIZE
        );

    const tx = new web3.Transaction().add(
        web3.SystemProgram.createAccount({
            fromPubkey: program.provider.wallet.publicKey,
            newAccountPubkey: mint.publicKey,
            space: MINT_SIZE,
            lamports,
            programId: TOKEN_PROGRAM_ID,
        }),
        createInitializeMintInstruction(
            mint.publicKey,
            decimals,
            program.provider.wallet.publicKey,
            null
        )
    );

    await program.provider.sendAndConfirm(tx, [mint]);

    return mint;
}

interface CreateAssociatedTokenAccountArgs {
    program: Program<Metrom>;
    mint: web3.PublicKey;
    owner: web3.PublicKey;
}

export async function createAssociatedTokenAccount({
    program,
    mint,
    owner,
}: CreateAssociatedTokenAccountArgs): Promise<web3.PublicKey> {
    const associatedTokenAccount = getAssociatedTokenAddressSync(mint, owner);

    await program.provider.sendAndConfirm(
        new web3.Transaction().add(
            createAssociatedTokenAccountInstruction(
                program.provider.wallet.publicKey,
                associatedTokenAccount,
                owner,
                mint
            )
        )
    );

    return associatedTokenAccount;
}

interface MintToArgs {
    program: Program<Metrom>;
    mint: web3.Keypair;
    amount: number;
    to: web3.PublicKey;
}

export async function mintTo({
    program,
    mint,
    amount,
    to,
}: MintToArgs): Promise<web3.Keypair> {
    await program.provider.sendAndConfirm(
        new web3.Transaction().add(
            createMintToInstruction(
                mint.publicKey,
                to,
                program.provider.wallet.publicKey,
                amount
            )
        )
    );

    return mint;
}
