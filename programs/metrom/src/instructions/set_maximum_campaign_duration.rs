use anchor_lang::prelude::*;

use crate::{errors::Error, state::State};

#[event]
struct SetMaximumCampaignDurationEvent {
    maximum_campaign_duration: u32,
}

pub fn handle_set_maximum_campaign_duration(
    ctx: Context<SetMaximumCampaignDuration>,
    maximum_campaign_duration: u32,
) -> Result<()> {
    require!(
        maximum_campaign_duration > ctx.accounts.state.minimum_campaign_duration,
        Error::InvalidMaximumCampaignDuration
    );
    require!(
        ctx.accounts.signer.key() == ctx.accounts.state.owner.key(),
        Error::Forbidden
    );

    ctx.accounts.state.maximum_campaign_duration = maximum_campaign_duration;

    emit!(SetMaximumCampaignDurationEvent {
        maximum_campaign_duration
    });

    Ok(())
}

#[derive(Accounts)]
pub struct SetMaximumCampaignDuration<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(mut, seeds = [b"state"], bump)]
    pub state: Account<'info, State>,
}
