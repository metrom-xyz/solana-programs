use anchor_lang::prelude::*;

use crate::{errors::Error, state::State};

#[event]
struct SetMinimumCampaignDurationEvent {
    minimum_campaign_duration: u32,
}

pub fn handle_set_minimum_campaign_duration(
    ctx: Context<SetMinimumCampaignDuration>,
    minimum_campaign_duration: u32,
) -> Result<()> {
    require!(
        minimum_campaign_duration < ctx.accounts.state.maximum_campaign_duration,
        Error::InvalidMinimumCampaignDuration
    );
    require!(
        ctx.accounts.signer.key() == ctx.accounts.state.owner.key(),
        Error::Forbidden
    );

    ctx.accounts.state.minimum_campaign_duration = minimum_campaign_duration;

    emit!(SetMinimumCampaignDurationEvent {
        minimum_campaign_duration
    });

    Ok(())
}

#[derive(Accounts)]
pub struct SetMinimumCampaignDuration<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(mut, seeds = [b"state"], bump)]
    pub state: Account<'info, State>,
}
