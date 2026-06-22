use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    self, spl_pod::option::Nullable, Mint, TokenAccount, TokenInterface, TransferChecked,
};
use solana_program::keccak::hash as keccak256;

use crate::{
    errors::Error,
    state::{Campaign, CampaignData, ClaimedReward, State},
};

#[event]
struct ClaimRewardEvent {
    campaign_id: [u8; 32],
    mint: Pubkey,
    amount: u64,
    receiver: Pubkey,
}

pub fn handle_claim_reward(
    ctx: Context<ClaimReward>,
    proof: Vec<[u8; 32]>,
    amount: u64,
) -> Result<()> {
    let campaign_id = ctx.accounts.campaign.key().to_bytes();
    let mint = ctx.accounts.mint.key();
    let receiver = ctx.accounts.receiver_token_account.key();

    let accounts = ctx.accounts;
    let claimed_amount = process_claim(
        &accounts.signer,
        &accounts.state,
        ctx.bumps.state,
        &mut accounts.campaign,
        &mut accounts.user_claimed_reward,
        &accounts.mint,
        &accounts.treasury_token_account,
        &accounts.receiver_token_account,
        &accounts.token_program,
        proof,
        amount,
        false,
    )?;

    emit!(ClaimRewardEvent {
        campaign_id,
        mint,
        amount: claimed_amount,
        receiver
    });

    Ok(())
}

#[event]
struct RecoverRewardEvent {
    campaign_id: [u8; 32],
    mint: Pubkey,
    amount: u64,
    receiver: Pubkey,
}

pub fn handle_recover_reward(
    ctx: Context<RecoverReward>,
    proof: Vec<[u8; 32]>,
    amount: u64,
) -> Result<()> {
    let campaign_id = ctx.accounts.campaign.key().to_bytes();
    let mint = ctx.accounts.mint.key();
    let receiver = ctx.accounts.receiver_token_account.key();

    let accounts = ctx.accounts;
    let claimed_amount = process_claim(
        &accounts.signer,
        &accounts.state,
        ctx.bumps.state,
        &mut accounts.campaign,
        &mut accounts.user_reimbursed_reward,
        &accounts.mint,
        &accounts.treasury_token_account,
        &accounts.receiver_token_account,
        &accounts.token_program,
        proof,
        amount,
        true,
    )?;

    emit!(RecoverRewardEvent {
        campaign_id,
        mint,
        amount: claimed_amount,
        receiver
    });

    Ok(())
}

#[derive(Accounts)]
pub struct ClaimReward<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(mut, seeds = [b"state"], bump)]
    pub state: Account<'info, State>,
    #[account(mut)]
    pub campaign: Account<'info, Campaign>,
    #[account(
        init_if_needed,
        space = 8 + ClaimedReward::INIT_SPACE,
        payer = signer,
        seeds = [
            b"claimed_reward",
            signer.key().as_ref(),
            campaign.key().as_ref()
        ],
        bump
    )]
    pub user_claimed_reward: Account<'info, ClaimedReward>,
    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        token::mint = mint,
        token::authority = state,
        token::token_program = token_program,
        seeds = [b"treasury_token_account", mint.key().as_ref()],
        bump
    )]
    pub treasury_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = mint,
        token::authority = signer,
        token::token_program = token_program,
    )]
    pub receiver_token_account: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RecoverReward<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(mut, seeds = [b"state"], bump)]
    pub state: Account<'info, State>,
    #[account(mut)]
    pub campaign: Account<'info, Campaign>,
    #[account(
        init_if_needed,
        space = 8 + ClaimedReward::INIT_SPACE,
        payer = signer,
        seeds = [
            b"reimbursed_reward",
            signer.key().as_ref(),
            campaign.key().as_ref()
        ],
        bump
    )]
    pub user_reimbursed_reward: Account<'info, ClaimedReward>,
    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        token::mint = mint,
        token::authority = state,
        token::token_program = token_program,
        seeds = [b"treasury_token_account", mint.key().as_ref()],
        bump
    )]
    pub treasury_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = mint,
        token::authority = signer,
        token::token_program = token_program,
    )]
    pub receiver_token_account: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

fn process_claim<'info>(
    signer: &Signer<'info>,
    state: &Account<'info, State>,
    state_bump: u8,
    campaign: &mut Account<'info, Campaign>,
    user_claimed_reward: &mut Account<'info, ClaimedReward>,
    mint: &InterfaceAccount<'info, Mint>,
    treasury_token_account: &InterfaceAccount<'info, TokenAccount>,
    receiver_token_account: &InterfaceAccount<'info, TokenAccount>,
    token_program: &Interface<'info, TokenInterface>,
    proof: Vec<[u8; 32]>,
    amount: u64,
    recovering: bool,
) -> Result<u64> {
    require!(amount > 0, Error::NoRewardAmount);

    let signer_key = signer.key();
    let campaign_owner = campaign.base.owner;

    let rewards_campaign_data = match campaign.data {
        CampaignData::Rewards(ref mut data) => data,
        CampaignData::Points(_) => return err!(Error::InvalidCampaignType),
    };

    require!(rewards_campaign_data.root.is_some(), Error::NoRoot);
    require!(
        rewards_campaign_data.mint == mint.key(),
        Error::NonExistentReward
    );
    if recovering {
        require!(signer_key == campaign_owner, Error::Forbidden);
    }

    require!(
        verify_merkle_proof(
            rewards_campaign_data.root.unwrap(),
            proof,
            if recovering { Pubkey::NONE } else { signer_key },
            mint.key(),
            amount
        ),
        Error::InvalidProof
    );

    let claimed_amount = amount - user_claimed_reward.claimed;
    require!(claimed_amount > 0, Error::NoRewardAmount);
    require!(
        claimed_amount <= rewards_campaign_data.amount,
        Error::InconsistentClaimedRewardAmount
    );

    user_claimed_reward.claimed += claimed_amount;
    rewards_campaign_data.amount -= claimed_amount;

    let signer_seeds: &[&[&[u8]]] = &[&[b"state", &[state_bump]]];

    let cpi_context = CpiContext::new(
        token_program.to_account_info(),
        TransferChecked {
            from: treasury_token_account.to_account_info(),
            to: receiver_token_account.to_account_info(),
            authority: state.to_account_info(),
            mint: mint.to_account_info(),
        },
    )
    .with_signer(signer_seeds);
    token_interface::transfer_checked(cpi_context, claimed_amount, mint.decimals)?;

    Ok(claimed_amount)
}

fn verify_merkle_proof(
    root: [u8; 32],
    proof: Vec<[u8; 32]>,
    claim_owner: Pubkey,
    token: Pubkey,
    amount: u64,
) -> bool {
    let mut leaf = [0u8; 72];
    leaf[0..32].copy_from_slice(claim_owner.as_ref());
    leaf[32..64].copy_from_slice(token.as_ref());
    leaf[64..72].copy_from_slice(&amount.to_le_bytes());

    let mut computed_hash = keccak256(keccak256(&leaf).as_bytes()).to_bytes();
    for proof_item in proof {
        let combined = if computed_hash < proof_item {
            [computed_hash.as_ref(), proof_item.as_ref()].concat()
        } else {
            [proof_item.as_ref(), computed_hash.as_ref()].concat()
        };

        computed_hash = keccak256(&combined).to_bytes();
    }

    computed_hash == root
}
