mod constants;
mod errors;
mod instructions;
mod state;

use anchor_lang::prelude::*;

use instructions::accept_campaign_ownership::*;
use instructions::accept_ownership::*;
use instructions::claim_fee::*;
use instructions::claim_reward::*;
use instructions::create_points_campaign::*;
use instructions::create_rewards_campaign::*;
use instructions::distribute_rewards::*;
use instructions::initialize::*;
use instructions::set_fee::*;
use instructions::set_fee_rebate::*;
use instructions::set_maximum_campaign_duration::*;
use instructions::set_minimum_campaign_duration::*;
use instructions::set_minimum_token_rates::*;
use instructions::set_updater::*;
use instructions::transfer_campaign_ownership::*;
use instructions::transfer_ownership::*;

declare_id!("CjVurumkimPq7vubn7zDtgZUoeNzF8ZF3oo8zJzcWykx");

#[program]
mod metrom {

    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        updater: Pubkey,
        fee: u32,
        minimum_campaign_duration: u32,
        maximum_campaign_duration: u32,
    ) -> Result<()> {
        handle_initialize(
            ctx,
            updater,
            fee,
            minimum_campaign_duration,
            maximum_campaign_duration,
        )
    }

    pub fn create_rewards_campaign(
        ctx: Context<CreateRewardsCampaign>,
        from: u64,
        to: u64,
        kind: u32,
        data: Vec<u8>,
        specification_hash: [u8; 32],
        reward_amount: u64,
    ) -> Result<()> {
        handle_create_rewards_campaign(ctx, from, to, kind, data, specification_hash, reward_amount)
    }

    pub fn create_points_campaign(
        ctx: Context<CreatePointsCampaign>,
        from: u64,
        to: u64,
        kind: u32,
        data: Vec<u8>,
        specification_hash: [u8; 32],
        points: u64,
    ) -> Result<()> {
        handle_create_points_campaign(ctx, from, to, kind, data, specification_hash, points)
    }

    pub fn distribute_rewards(
        ctx: Context<DistributeRewards>,
        root: [u8; 32],
        data_hash: [u8; 32],
    ) -> Result<()> {
        handle_distribute_rewards(ctx, root, data_hash)
    }

    pub fn set_minimum_reward_token_rate(
        ctx: Context<SetMinimumRewardTokenRates>,
        minimum_rate: u64,
    ) -> Result<()> {
        handle_set_minimum_reward_token_rate(ctx, minimum_rate)
    }

    pub fn set_minimum_fee_token_rate(
        ctx: Context<SetMinimumFeeTokenRates>,
        minimum_rate: u64,
    ) -> Result<()> {
        handle_set_minimum_fee_token_rate(ctx, minimum_rate)
    }

    pub fn claim_reward(
        ctx: Context<ClaimReward>,
        proof: Vec<[u8; 32]>,
        amount: u64,
    ) -> Result<()> {
        handle_claim_reward(ctx, proof, amount)
    }

    pub fn recover_reward(
        ctx: Context<RecoverReward>,
        proof: Vec<[u8; 32]>,
        amount: u64,
    ) -> Result<()> {
        handle_recover_reward(ctx, proof, amount)
    }

    pub fn claim_fee(ctx: Context<ClaimFee>) -> Result<()> {
        handle_claim_fee(ctx)
    }

    pub fn transfer_campaign_ownership(
        ctx: Context<TransferCampaignOwnership>,
        owner: Pubkey,
    ) -> Result<()> {
        handle_transfer_campaign_ownership(ctx, owner)
    }

    pub fn accept_campaign_ownership(ctx: Context<AcceptCampaignOwnership>) -> Result<()> {
        handle_accept_campaign_ownership(ctx)
    }

    pub fn transfer_ownership(ctx: Context<TransferOwnership>, owner: Pubkey) -> Result<()> {
        handle_transfer_ownership(ctx, owner)
    }

    pub fn accept_ownership(ctx: Context<AcceptOwnership>) -> Result<()> {
        handle_accept_ownership(ctx)
    }

    pub fn set_updater(ctx: Context<SetUpdater>, updater: Pubkey) -> Result<()> {
        handle_set_updater(ctx, updater)
    }

    pub fn set_fee(ctx: Context<SetFee>, fee: u32) -> Result<()> {
        handle_set_fee(ctx, fee)
    }

    pub fn set_fee_rebate(ctx: Context<SetFeeRebate>, account: Pubkey, rebate: u32) -> Result<()> {
        handle_set_fee_rebate(ctx, account, rebate)
    }

    pub fn set_minimum_campaign_duration(
        ctx: Context<SetMinimumCampaignDuration>,
        minimum_campaign_duration: u32,
    ) -> Result<()> {
        handle_set_minimum_campaign_duration(ctx, minimum_campaign_duration)
    }

    pub fn set_maximum_campaign_duration(
        ctx: Context<SetMaximumCampaignDuration>,
        maximum_campaign_duration: u32,
    ) -> Result<()> {
        handle_set_maximum_campaign_duration(ctx, maximum_campaign_duration)
    }
}
