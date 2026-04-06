use anchor_lang::prelude::*;

use crate::{
    constants::U32_1_000_000,
    errors::Error,
    state::{FeeRebate, State},
};

#[event]
struct SetFeeRebateEvent {
    account: Pubkey,
    rebate: u32,
}

pub fn handle_set_fee_rebate(
    ctx: Context<SetFeeRebate>,
    account: Pubkey,
    rebate: u32,
) -> Result<()> {
    require!(rebate <= U32_1_000_000, Error::InvalidRebate);
    require!(
        ctx.accounts.signer.key() == ctx.accounts.state.owner.key(),
        Error::Forbidden
    );

    ctx.accounts.fee_rebate.rebate = rebate;

    emit!(SetFeeRebateEvent { account, rebate });

    Ok(())
}

#[derive(Accounts)]
#[instruction(account: Pubkey)]
pub struct SetFeeRebate<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(seeds = [b"state"], bump)]
    pub state: Account<'info, State>,
    #[account(
        init_if_needed,
        payer = signer,
        space = 8 + FeeRebate::INIT_SPACE,
        seeds = [b"fee_rebate", account.as_ref()],
        bump
    )]
    pub fee_rebate: Account<'info, FeeRebate>,
    pub system_program: Program<'info, System>,
}
