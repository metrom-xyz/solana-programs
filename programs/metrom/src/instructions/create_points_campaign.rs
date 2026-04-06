use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::{
    constants::{U32_1_000_000, U64_1_000_000, U64_1_HOUR_SECONDS},
    errors::Error,
    state::{
        BaseCampaign, Campaign, CampaignData, ClaimableFee, FeeRebate, MinimumTokenRate,
        PointsCampaignData, State,
    },
};

#[event]
struct CreatePointsCampaignEvent {
    id: [u8; 32],
    owner: Pubkey,
    from: u64,
    to: u64,
    kind: u32,
    data: Vec<u8>,
    specification_hash: Option<[u8; 32]>,
    points: u64,
    fee_token: Pubkey,
    fee: u64,
}

pub fn handle_create_points_campaign(
    ctx: Context<CreatePointsCampaign>,
    from: u64,
    to: u64,
    kind: u32,
    data: Vec<u8>,
    specification_hash: [u8; 32],
    points: u64,
) -> Result<()> {
    require!(points > 0, Error::NoPoints);

    let state = &ctx.accounts.state;
    let signer_key = ctx.accounts.signer.key();

    let base_campaign = BaseCampaign::new(
        signer_key,
        from,
        to,
        kind,
        data.clone(),
        specification_hash,
        state.minimum_campaign_duration,
        state.maximum_campaign_duration,
    )?;

    let fee_amount = ctx.accounts.minimum_fee_token_rate.minimum_rate * base_campaign.duration
        / U64_1_HOUR_SECONDS;
    let fee_amount =
        fee_amount * ((U32_1_000_000 - ctx.accounts.fee_rebate.rebate) as u64) / U64_1_000_000;

    let cpi_accounts = TransferChecked {
        from: ctx.accounts.sender_token_account.to_account_info(),
        to: ctx.accounts.treasury_token_account.to_account_info(),
        authority: ctx.accounts.signer.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
    };
    let cpi_context = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
    token_interface::transfer_checked(cpi_context, fee_amount, ctx.accounts.mint.decimals)?;

    ctx.accounts.claimable_fee.claimable += fee_amount;

    let specification_hash = base_campaign.specification_hash.clone();

    ctx.accounts.campaign.base = base_campaign;
    ctx.accounts.campaign.data = CampaignData::Points(PointsCampaignData { amount: points });

    emit!(CreatePointsCampaignEvent {
        id: ctx.accounts.campaign.key().to_bytes(),
        owner: signer_key,
        from,
        to,
        kind,
        data,
        specification_hash,
        points,
        fee_token: ctx.accounts.mint.key(),
        fee: fee_amount
    });

    Ok(())
}

#[derive(Accounts)]
#[instruction(
    from: u64,
    to: u64,
    kind: u32,
    data: Vec<u8>,
    specification_hash: [u8; 32],
    points: u64,
)]
pub struct CreatePointsCampaign<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(seeds = [b"state"], bump)]
    pub state: Account<'info, State>,
    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        init,
        payer = signer,
        space = 8 + Campaign::INIT_SPACE,
        seeds = [
            b"campaign",
            signer.key().as_ref(),
            &from.to_le_bytes(),
            &to.to_le_bytes(),
            &kind.to_le_bytes(),
            &data,
            &specification_hash,
            &mint.key().as_ref(),
            &points.to_le_bytes()
        ],
        bump
    )]
    pub campaign: Account<'info, Campaign>,
    #[account(
        init_if_needed,
        payer = signer,
        space = 8 + FeeRebate::INIT_SPACE,
        seeds = [b"fee_rebate", signer.key().as_ref()],
        bump
    )]
    pub fee_rebate: Account<'info, FeeRebate>,
    #[account(seeds = [b"minimum_fee_token_rate", mint.key().as_ref()], bump)]
    pub minimum_fee_token_rate: Account<'info, MinimumTokenRate>,
    #[account(
        init_if_needed,
        payer = signer,
        space = 8 + ClaimableFee::INIT_SPACE,
        seeds = [b"claimable_fee", mint.key().as_ref()],
        bump
    )]
    pub claimable_fee: Account<'info, ClaimableFee>,
    #[account(
        mut,
        token::mint = mint,
        token::authority = signer,
        token::token_program = token_program,
    )]
    pub sender_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = signer,
        token::mint = mint,
        token::authority = state,
        token::token_program = token_program,
        seeds = [b"treasury_token_account", mint.key().as_ref()],
        bump
    )]
    pub treasury_token_account: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}
