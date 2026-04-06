use anchor_lang::prelude::*;

use crate::{errors::Error, state::State};

#[event]
struct SetUpdaterEvent {
    updater: Pubkey,
}

pub fn handle_set_updater(ctx: Context<SetUpdater>, updater: Pubkey) -> Result<()> {
    require!(
        ctx.accounts.signer.key() == ctx.accounts.state.owner.key(),
        Error::Forbidden
    );

    ctx.accounts.state.updater = updater;

    emit!(SetUpdaterEvent { updater });

    Ok(())
}

#[derive(Accounts)]
pub struct SetUpdater<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(mut, seeds = [b"state"], bump)]
    pub state: Account<'info, State>,
}
