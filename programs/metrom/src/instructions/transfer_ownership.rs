use anchor_lang::prelude::*;

use crate::{errors::Error, state::State};

#[event]
struct TransferOwnershipEvent {
    owner: Pubkey,
}

pub fn handle_transfer_ownership(ctx: Context<TransferOwnership>, owner: Pubkey) -> Result<()> {
    let signer_key = ctx.accounts.signer.key();

    require!(
        signer_key == ctx.accounts.state.owner.key(),
        Error::Forbidden
    );

    ctx.accounts.state.pending_owner = Some(owner);

    emit!(TransferOwnershipEvent { owner: signer_key });

    Ok(())
}

#[derive(Accounts)]
pub struct TransferOwnership<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(mut, seeds = [b"state"], bump)]
    pub state: Account<'info, State>,
}
