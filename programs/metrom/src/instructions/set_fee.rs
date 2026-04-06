use anchor_lang::prelude::*;

use crate::{constants::U32_1_000_000, errors::Error, state::State};

#[event]
struct SetFeeEvent {
    fee: u32,
}

pub fn handle_set_fee(ctx: Context<SetFee>, fee: u32) -> Result<()> {
    require!(fee < U32_1_000_000, Error::InvalidFee);
    require!(
        ctx.accounts.signer.key() == ctx.accounts.state.owner.key(),
        Error::Forbidden
    );

    ctx.accounts.state.fee = fee;

    emit!(SetFeeEvent { fee });

    Ok(())
}

#[derive(Accounts)]
pub struct SetFee<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(mut, seeds = [b"state"], bump)]
    pub state: Account<'info, State>,
}
