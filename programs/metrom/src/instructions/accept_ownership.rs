use anchor_lang::prelude::*;

use crate::{errors::Error, state::State};

#[event]
struct AcceptOwnershipEvent {
    owner: Pubkey,
}

pub fn handle_accept_ownership(ctx: Context<AcceptOwnership>) -> Result<()> {
    let signer_key = ctx.accounts.signer.key();

    require!(
        ctx.accounts
            .state
            .pending_owner
            .is_some_and(|pending_owner| pending_owner == signer_key),
        Error::Forbidden
    );

    ctx.accounts.state.owner = signer_key;
    ctx.accounts.state.pending_owner = None;

    emit!(AcceptOwnershipEvent { owner: signer_key });

    Ok(())
}

#[derive(Accounts)]
pub struct AcceptOwnership<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(mut, seeds = [b"state"], bump)]
    pub state: Account<'info, State>,
}
