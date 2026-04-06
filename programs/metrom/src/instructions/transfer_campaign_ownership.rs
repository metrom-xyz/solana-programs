use anchor_lang::prelude::*;

use crate::{errors::Error, state::Campaign};

#[event]
struct TransferCampaignOwnershipEvent {
    campaign_id: [u8; 32],
    owner: Pubkey,
}

pub fn handle_transfer_campaign_ownership(
    ctx: Context<TransferCampaignOwnership>,
    owner: Pubkey,
) -> Result<()> {
    let signer_key = ctx.accounts.signer.key();

    require!(
        signer_key == ctx.accounts.campaign.base.owner,
        Error::Forbidden
    );

    ctx.accounts.campaign.base.pending_owner = Some(owner);

    emit!(TransferCampaignOwnershipEvent {
        campaign_id: ctx.accounts.campaign.key().to_bytes(),
        owner: signer_key
    });

    Ok(())
}

#[derive(Accounts)]
pub struct TransferCampaignOwnership<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(mut)]
    pub campaign: Account<'info, Campaign>,
}
