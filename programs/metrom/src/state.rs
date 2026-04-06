use anchor_lang::prelude::*;

use crate::{constants::ZERO_BYTES_32, errors::Error};

#[account]
#[derive(InitSpace)]
pub struct State {
    pub owner: Pubkey,
    pub pending_owner: Option<Pubkey>,
    pub updater: Pubkey,
    pub fee: u32,
    pub minimum_campaign_duration: u32,
    pub maximum_campaign_duration: u32,
}

#[account]
#[derive(InitSpace)]
pub struct FeeRebate {
    pub rebate: u32,
}

#[account]
#[derive(InitSpace)]
pub struct ClaimableFee {
    pub claimable: u64,
}

#[account]
#[derive(InitSpace)]
pub struct ClaimedReward {
    pub claimed: u64,
}

#[account]
#[derive(InitSpace)]
pub struct MinimumTokenRate {
    pub minimum_rate: u64,
}

pub fn validate_optional_hash(hash: [u8; 32]) -> Option<[u8; 32]> {
    if hash == ZERO_BYTES_32 {
        None
    } else {
        Some(hash)
    }
}

pub fn validate_required_hash(hash: [u8; 32]) -> Result<[u8; 32]> {
    validate_optional_hash(hash).ok_or(error!(Error::InvalidHash))
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct BaseCampaign {
    pub owner: Pubkey,
    pub pending_owner: Option<Pubkey>,
    pub from: u64,
    pub duration: u64,
    pub kind: u32,
    #[max_len(1024)]
    pub data: Vec<u8>,
    pub specification_hash: Option<[u8; 32]>,
}

impl BaseCampaign {
    pub fn new(
        owner: Pubkey,
        from: u64,
        to: u64,
        kind: u32,
        data: Vec<u8>,
        specification_hash: [u8; 32],
        minimum_campaign_duration: u32,
        maximum_campaign_duration: u32,
    ) -> Result<Self> {
        require!(
            from > Clock::get()?.unix_timestamp as u64,
            Error::InvalidStartTime
        );
        require!(
            to >= from + minimum_campaign_duration as u64,
            Error::InvalidDuration
        );
        let duration = to - from;
        require!(
            duration <= maximum_campaign_duration as u64,
            Error::InvalidDuration
        );

        Ok(Self {
            owner,
            pending_owner: None,
            from,
            duration,
            kind,
            data,
            specification_hash: validate_optional_hash(specification_hash),
        })
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, InitSpace, Clone)]
pub struct PointsCampaignData {
    pub amount: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, InitSpace, Clone)]
pub struct RewardsCampaignData {
    pub root: Option<[u8; 32]>,
    pub mint: Pubkey,
    pub amount: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, InitSpace, Clone)]
pub enum CampaignData {
    Points(PointsCampaignData),
    Rewards(RewardsCampaignData),
}

#[account]
#[derive(InitSpace)]
pub struct Campaign {
    pub base: BaseCampaign,
    pub data: CampaignData,
}
