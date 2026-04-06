use anchor_lang::prelude::*;

use crate::{errors::Error, state::Campaign};

#[event]
struct AcceptCampaignOwnershipEvent {
    campaign_id: [u8; 32],
    owner: Pubkey,
}

pub fn handle_accept_campaign_ownership(ctx: Context<AcceptCampaignOwnership>) -> Result<()> {
    let signer_key = ctx.accounts.signer.key();

    require!(
        ctx.accounts
            .campaign
            .base
            .pending_owner
            .is_some_and(|pending_owner| pending_owner == signer_key),
        Error::Forbidden
    );

    ctx.accounts.campaign.base.owner = signer_key;
    ctx.accounts.campaign.base.pending_owner = None;

    emit!(AcceptCampaignOwnershipEvent {
        campaign_id: ctx.accounts.campaign.key().to_bytes(),
        owner: signer_key
    });

    Ok(())
}

#[derive(Accounts)]
pub struct AcceptCampaignOwnership<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(mut)]
    pub campaign: Account<'info, Campaign>,
}
