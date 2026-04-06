use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};

use crate::{
    constants::{U64_1_000_000, U64_1_HOUR_SECONDS},
    errors::Error,
    state::{
        BaseCampaign, Campaign, CampaignData, ClaimableFee, FeeRebate, MinimumTokenRate,
        RewardsCampaignData, State,
    },
};

#[event]
struct CreateRewardsCampaignEvent {
    id: [u8; 32],
    owner: Pubkey,
    from: u64,
    to: u64,
    kind: u32,
    data: Vec<u8>,
    specification_hash: Option<[u8; 32]>,
    mint: Pubkey,
    reward_amount: u64,
    fee: u64,
}

pub fn handle_create_rewards_campaign(
    ctx: Context<CreateRewardsCampaign>,
    from: u64,
    to: u64,
    kind: u32,
    data: Vec<u8>,
    specification_hash: [u8; 32],
    reward_amount: u64,
) -> Result<()> {
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

    let resolved_fee =
        state.fee as u64 * (U64_1_000_000 - ctx.accounts.fee_rebate.rebate as u64) / U64_1_000_000;

    require!(
        reward_amount * U64_1_HOUR_SECONDS / base_campaign.duration
            >= ctx.accounts.minimum_reward_token_rate.minimum_rate,
        Error::RewardAmountTooLow
    );

    let decimals = ctx.accounts.mint.decimals;

    let cpi_accounts = TransferChecked {
        from: ctx.accounts.sender_token_account.to_account_info(),
        to: ctx.accounts.treasury_token_account.to_account_info(),
        authority: ctx.accounts.signer.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
    };
    let cpi_context = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
    token_interface::transfer_checked(cpi_context, reward_amount, decimals)?;

    let fee_amount = reward_amount * resolved_fee / U64_1_000_000;
    ctx.accounts.claimable_fee.claimable += fee_amount;

    let reward_amount_minus_fees = reward_amount - fee_amount;
    let specification_hash = base_campaign.specification_hash.clone();

    ctx.accounts.campaign.base = base_campaign;
    ctx.accounts.campaign.data = CampaignData::Rewards(RewardsCampaignData {
        root: None,
        mint: ctx.accounts.mint.key(),
        amount: reward_amount_minus_fees,
    });

    emit!(CreateRewardsCampaignEvent {
        id: ctx.accounts.campaign.key().to_bytes(),
        owner: signer_key,
        from,
        to,
        kind,
        data,
        specification_hash,
        mint: ctx.accounts.mint.key(),
        reward_amount: reward_amount_minus_fees,
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
    reward_amount: u64,
)]
pub struct CreateRewardsCampaign<'info> {
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
            &reward_amount.to_le_bytes()
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
    #[account(seeds = [b"minimum_reward_token_rate", mint.key().as_ref()], bump)]
    pub minimum_reward_token_rate: Account<'info, MinimumTokenRate>,
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
