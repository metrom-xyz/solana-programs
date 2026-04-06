use anchor_lang::prelude::*;

use crate::{constants::U64_1_000_000, errors::Error, state::State};

#[event]
struct InitializeEvent {
    pub owner: Pubkey,
    pub updater: Pubkey,
    pub fee: u32,
    pub minimum_campaign_duration: u32,
    pub maximum_campaign_duration: u32,
}

pub fn handle_initialize(
    ctx: Context<Initialize>,
    updater: Pubkey,
    fee: u32,
    minimum_campaign_duration: u32,
    maximum_campaign_duration: u32,
) -> Result<()> {
    let signer_key = ctx.accounts.signer.key();

    require!((fee as u64) < U64_1_000_000, Error::InvalidFee);
    require!(
        minimum_campaign_duration < maximum_campaign_duration,
        Error::InvalidMinimumCampaignDuration
    );

    ctx.accounts.state.owner = signer_key;
    ctx.accounts.state.pending_owner = None;
    ctx.accounts.state.updater = updater;
    ctx.accounts.state.fee = fee;
    ctx.accounts.state.minimum_campaign_duration = minimum_campaign_duration;
    ctx.accounts.state.maximum_campaign_duration = maximum_campaign_duration;

    emit!(InitializeEvent {
        owner: signer_key,
        updater,
        fee,
        minimum_campaign_duration,
        maximum_campaign_duration,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(init, payer = signer, space = 8 + State::INIT_SPACE, seeds = [b"state"], bump)]
    pub state: Account<'info, State>,
    pub system_program: Program<'info, System>,
}
