use anchor_lang::prelude::*;

use crate::{
    errors::Error,
    state::{validate_required_hash, Campaign, CampaignData, State},
};

#[event]
struct DistributeRewardEvent {
    campaign_id: [u8; 32],
    root: [u8; 32],
    data_hash: [u8; 32],
}

pub fn handle_distribute_rewards(
    ctx: Context<DistributeRewards>,
    root: [u8; 32],
    data_hash: [u8; 32],
) -> Result<()> {
    require!(
        ctx.accounts.signer.key() == ctx.accounts.state.updater.key(),
        Error::Forbidden,
    );

    let root = validate_required_hash(root)?;

    match ctx.accounts.campaign.data {
        CampaignData::Rewards(ref mut data) => {
            data.root = Some(root);
        }
        CampaignData::Points(_) => return err!(Error::InvalidCampaignType),
    }

    emit!(DistributeRewardEvent {
        campaign_id: ctx.accounts.campaign.key().to_bytes(),
        root,
        data_hash,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct DistributeRewards<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(seeds = [b"state"], bump)]
    pub state: Account<'info, State>,
    #[account(mut)]
    pub campaign: Account<'info, Campaign>,
}
