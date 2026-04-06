use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::{
    errors::Error,
    state::{MinimumTokenRate, State},
};

#[event]
struct SetMinimumRewardTokenRateEvent {
    mint: Pubkey,
    minimum_rate: u64,
}

pub fn handle_set_minimum_reward_token_rate(
    ctx: Context<SetMinimumRewardTokenRates>,
    minimum_rate: u64,
) -> Result<()> {
    require!(
        ctx.accounts.signer.key() == ctx.accounts.state.updater,
        Error::Forbidden
    );
    ctx.accounts.minimum_reward_token_rate.minimum_rate = minimum_rate;

    emit!(SetMinimumRewardTokenRateEvent {
        mint: ctx.accounts.mint.key(),
        minimum_rate,
    });

    Ok(())
}

#[derive(Accounts)]
#[instruction(minimum_rate: u64)]
pub struct SetMinimumRewardTokenRates<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(seeds = [b"state"], bump)]
    pub state: Account<'info, State>,
    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        init_if_needed,
        payer = signer,
        space = 8 + MinimumTokenRate::INIT_SPACE,
        seeds = [b"minimum_reward_token_rate", mint.key().as_ref()],
        bump
    )]
    pub minimum_reward_token_rate: Account<'info, MinimumTokenRate>,
    pub system_program: Program<'info, System>,
}

#[event]
struct SetMinimumFeeTokenRateEvent {
    mint: Pubkey,
    minimum_rate: u64,
}

pub fn handle_set_minimum_fee_token_rate(
    ctx: Context<SetMinimumFeeTokenRates>,
    minimum_rate: u64,
) -> Result<()> {
    require!(
        ctx.accounts.signer.key() == ctx.accounts.state.updater,
        Error::Forbidden
    );

    ctx.accounts.minimum_fee_token_rate.minimum_rate = minimum_rate;

    emit!(SetMinimumFeeTokenRateEvent {
        mint: ctx.accounts.mint.key(),
        minimum_rate,
    });

    Ok(())
}

#[derive(Accounts)]
#[instruction(minimum_rate: u64)]
pub struct SetMinimumFeeTokenRates<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(seeds = [b"state"], bump)]
    pub state: Account<'info, State>,
    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        init_if_needed,
        payer = signer,
        space = 8 + MinimumTokenRate::INIT_SPACE,
        seeds = [b"minimum_fee_token_rate", mint.key().as_ref()],
        bump
    )]
    pub minimum_fee_token_rate: Account<'info, MinimumTokenRate>,
    pub system_program: Program<'info, System>,
}
