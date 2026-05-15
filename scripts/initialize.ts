import {
    setProvider,
    AnchorProvider,
    web3,
    Program,
    Wallet,
} from "@coral-xyz/anchor";
import fs from "node:fs";

function env(name: string): string {
    const v = process.env[name];
    if (!v) throw new Error(`Missing env ${name}`);
    return v;
}

async function main() {
    const connection = new web3.Connection(env("RPC_URL"), "confirmed");

    const secret = JSON.parse(fs.readFileSync(env("KEYPAIR"), "utf-8"));
    const wallet = new Wallet(
        web3.Keypair.fromSecretKey(new Uint8Array(secret))
    );
    const provider = new AnchorProvider(connection, wallet, {
        commitment: "confirmed",
    });
    setProvider(provider);

    const idl = JSON.parse(
        fs.readFileSync("./target/idl/metrom.json", "utf-8")
    );
    const program = new Program(idl, provider);

    const [state] = web3.PublicKey.findProgramAddressSync(
        [Buffer.from("state")],
        program.programId
    );

    await program.methods
        .initialize(
            new web3.PublicKey(env("UPDATER")),
            parseInt(env("FEE")),
            parseInt(env("MINIMUM_CAMPAIGN_DURATION")),
            parseInt(env("MAXIMUM_CAMPAIGN_DURATION"))
        )
        .accounts({
            signer: provider.wallet.publicKey,
            state,
            systemProgram: web3.SystemProgram.programId,
        })
        .rpc();

    console.log("Program initialized");
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
